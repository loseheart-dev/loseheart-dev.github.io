---
title: 一个较为复杂的业务逻辑：订单取消和支付并发
date: 2026-10-24 23:04:00
categories: 项目经验
tags:
  - 复杂业务
  - 并发
  - RabbitMQ
description: 复盘我在使用延迟消息来实现超时订单自动取消的需求时遇到一个较为复杂的并发问题
---

使用延迟消息实现订单超时自动取消，我们想按照这样的流程实现:

![超时取消订单流程](/images/acbp/cancel-order-flow.png)

我起初关注的是两件事：关闭交易订单，恢复商品库存。但事实上这样的逻辑存在严重的bug，可能出现订单已经取消，库存也恢复了，但是用户却扣了款的情况

## 先区分交易订单（order）和支付订单（payOrder）

交易订单记录商品、数量、金额和履约状态；支付单记录一笔支付请求的状态。它们不是同一条记录，关闭其中一条，不会自动关闭另一条。

所以事实上支付单**payOrder**的命名是不尽如人意的，如果将其命名为payRequest，会更易于理解。

我们来看看这两个实体各自使用哪些状态来记录支付状态吧

| 对象 | 常量 | 数值 | 含义 |
| --- | --- | --- | --- |
| 交易订单 | `OrderStatus.UNPAID` | 1 | 未付款 |
| 交易订单 | `OrderStatus.PAID` | 2 | 已付款、未发货 |
| 交易订单 | `OrderStatus.CLOSED` | 5 | 订单已取消、已关闭 |
| 支付单 | `PayStatus.NOT_COMMIT` | 0 | 未提交 |
| 支付单 | `PayStatus.WAIT_BUYER_PAY` | 1 | 待支付 |
| 支付单 | `PayStatus.TRADE_CLOSED` | 2 | 已关闭 |
| 支付单 | `PayStatus.TRADE_SUCCESS` | 3 | 支付成功 |

bizOrderNO作为payOrder的外键来关联Order

## 原来的风险是如何产生的

原来的取消路径主要做了以下操作：

```text
交易订单：未付款 → 已关闭
商品库存：加回购买数量
```

但没有同步关闭支付单。原来的余额支付路径又只检查支付单状态，核心逻辑可以概括为下面的简化代码：

```java
PayOrder po = getById(form.getId());
if (!PayStatus.WAIT_BUYER_PAY.equalsValue(po.getStatus())) {
    throw new BizIllegalException("交易已支付或关闭！");
}

userClient.deductMoney(form.getPw(), po.getAmount());
// 后续更新支付单，并发送支付成功消息
```
因此，代码可能允许出现这样的时序：

| 时刻 | 交易订单 | 支付单 | 后果 |
| --- | --- | --- | --- |
| 下单并申请支付后 | 未付款 | 待支付 | 已扣减库存 |
| 超时取消后 | 已关闭 | 仍待支付 | 库存已恢复 |
| 用户再次请求付款 | 已关闭 | 待支付检查通过 | 仍可能扣余额 |
| 支付成功消息到达 | 仍已关闭 | 支付成功 | 订单无法正常转为已付款 |

最后一步为什么无法更新？因为交易订单的更新本来就带有状态条件：

```java
.eq(Order::getStatus, OrderStatus.UNPAID)
```

## 三、修复核心：把交易订单的条件更新放到扣款之前

付款和取消都必须操作同一条交易订单，并且只允许从 `UNPAID` 状态迁移：

```text
                       ┌─ 付款：PAID
交易订单：UNPAID ───────┤
                       └─ 取消：CLOSED
```

付款的条件更新是：

```sql
UPDATE `order`
SET status = 2, pay_time = ?
WHERE id = ? AND status = 1;
```

取消的条件更新是：

```sql
UPDATE `order`
SET status = 5, close_time = ?
WHERE id = ? AND status = 1;
```

这里的 `WHERE status = 1` 是关键。状态检查与修改在同一条 SQL 中执行，而不是先查出来，再根据旧结果无条件更新。

两条更新竞争同一行。在事务和锁机制正常工作的前提下，一方成功提交状态迁移后，另一方就不能再从 `UNPAID` 成功迁移；发生冲突时也可能等待或抛出异常，不能理解为每次竞争失败都会立即返回 `false`。如果先执行的一方回滚，另一方之后仍可能成功。

### 1. 返回交易订单是否更新成功

交易服务中的实现为：

```java
@Override
public boolean markOrderPaySuccess(Long orderId) {
    return lambdaUpdate()
            .set(Order::getStatus, OrderStatus.PAID)
            .set(Order::getPayTime, LocalDateTime.now())
            .eq(Order::getId, orderId)
            .eq(Order::getStatus, OrderStatus.UNPAID)
            .update();
}
```

原来的返回类型是 `void`，调用方无法利用更新结果。现在需要沿整个调用链返回 `boolean`：

```text
OrderServiceImpl → IOrderService → OrderController → OrderClient
```

### 2. 付款先更新状态，再扣余额

下面是当前付款方法的核心执行部分，省略了后面的消息发送：

```java
@Override
@GlobalTransactional
public void tryPayOrderByBalance(PayOrderFormDTO form) {
    PayOrder po = getById(form.getId());
    if (po == null) {
        throw new BizIllegalException("支付单不存在");
    }
    if (!PayStatus.WAIT_BUYER_PAY.equalsValue(po.getStatus())) {
        throw new BizIllegalException("交易已支付或关闭！");
    }

    // 先与取消订单竞争交易订单的状态迁移
    boolean orderUpdated =
            orderClient.markOrderPaySuccess(po.getBizOrderNo());
    if (!orderUpdated) {
        throw new BizIllegalException("订单不存在、已支付或已关闭！");
    }

    boolean payUpdated =
            markPayOrderSuccess(po.getId(), LocalDateTime.now());
    if (!payUpdated) {
        throw new BizIllegalException("交易已支付或关闭！");
    }

    userClient.deductMoney(form.getPw(), po.getAmount());
}
```

`orderUpdated` 和 `payUpdated` 分别回答两个问题：

- 这条交易订单，本次是否成功从未付款改为已付款？
- 这张支付单，本次是否成功从允许支付的状态改为支付成功？

只有两次条件更新都成功，代码才会走到扣余额。

支付单的更新同样带有状态条件：

```java
public boolean markPayOrderSuccess(Long id, LocalDateTime successTime) {
    return lambdaUpdate()
            .set(PayOrder::getStatus, PayStatus.TRADE_SUCCESS.getValue())
            .set(PayOrder::getPaySuccessTime, successTime)
            .eq(PayOrder::getId, id)
            .in(PayOrder::getStatus,
                    PayStatus.NOT_COMMIT.getValue(),
                    PayStatus.WAIT_BUYER_PAY.getValue())
            .update();
}
```

当前付款入口先要求支付单为 `WAIT_BUYER_PAY`；这个更新方法本身允许 `NOT_COMMIT` 和 `WAIT_BUYER_PAY` 两种来源状态。这是现有代码的实际边界。

## 四、取消路径：关闭交易订单、关闭支付单、恢复库存

取消方法的核心代码为：

```java
@Override
@GlobalTransactional
public void cancelOrder(Long orderId) {
    boolean success = lambdaUpdate()
            .set(Order::getStatus, OrderStatus.CLOSED)
            .set(Order::getCloseTime, LocalDateTime.now())
            .eq(Order::getId, orderId)
            .eq(Order::getStatus, OrderStatus.UNPAID)
            .update();

    if (!success) {
        return;
    }
    if (!payClient.cancelPayOrder(orderId)) {
        throw new BadRequestException("支付单状态不允许关闭，取消订单失败");
    }

    List<OrderDetail> details = detailService.lambdaQuery()
            .eq(OrderDetail::getOrderId, orderId)
            .list();
    if (details.isEmpty()) {
        throw new BadRequestException("订单明细不存在，无法恢复库存");
    }

    List<OrderDetailDTO> items = details.stream()
            .map(detail -> new OrderDetailDTO()
                    .setItemId(detail.getItemId())
                    .setNum(detail.getNum()))
            .collect(Collectors.toList());

    itemClient.restoreStock(items);
}
```

执行顺序有明确的业务含义：

1. 交易订单没有关闭成功，就不再关闭支付单，也不恢复库存。
2. 交易订单关闭成功，但支付单不允许关闭，就抛异常。
3. 两者处理成功后，才根据订单明细恢复库存。

重复取消时，交易订单已经不是 `UNPAID`，第一步就会退出，因此不会再次恢复库存。

支付单关闭方法需要区分“本次更新成功”和“目标状态本来就已满足”：

```java
@Override
public boolean cancelPayOrder(Long orderId) {
    boolean closed = lambdaUpdate()
            .set(PayOrder::getStatus, PayStatus.TRADE_CLOSED.getValue())
            .eq(PayOrder::getBizOrderNo, orderId)
            .in(PayOrder::getStatus,
                    PayStatus.NOT_COMMIT.getValue(),
                    PayStatus.WAIT_BUYER_PAY.getValue())
            .update();

    if (closed) {
        return true;
    }

    PayOrder po = queryByBizOrderNo(orderId);
    return po == null
            || PayStatus.TRADE_CLOSED.equalsValue(po.getStatus());
}
```

| 情况 | 返回结果 | 含义 |
| --- | --- | --- |
| 本次关闭成功 | `true` | 可以继续取消 |
| 已经关闭 | `true` | 重复操作仍然成功 |
| 支付单不存在 | `true` | 当前没有支付单需要关闭 |
| 已支付或其他不允许关闭的状态 | `false` | 阻止本次取消 |
| 数据库或远程调用异常 | 抛异常 | 中断流程 |

这里 `true` 的含义是“允许继续取消交易订单”，不一定表示实际更新了一条支付单。

恢复库存由商品服务执行 `stock = stock + num`，检查每个商品的更新行数，并通过本地事务避免一批商品只恢复一部分；取消流程的跨服务回滚则依赖全局事务。
