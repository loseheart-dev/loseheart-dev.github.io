---
title: 学习分布式事务
date: 2026-10-120 13:50:00
categories: 技术笔记
tags:
  - 数据库
  - 分布式事务
  - seata
description: 记录一些学习分布式事务的感受和知识（虽然不一定会在这里复习）
---

借着完成web前端这门课课程项目的机会，我做了自己的个人博客，并决定分享自己的学习和生活，这也是我正式写的第一篇博客。

微服务这块已经拖了蛮长时间的了，前两天听了杭助学长的找工作有关的分享，我再次焦虑，所以我加快了进度，开始了分布式事务的学习。

## 数据库事务

首先我们先回顾下数据库事务。事务本质上是为了解决“多步操作如何保证数据正确”的问题。比如购买一个商品，在点击支付后，至少要有扣减商品库存，扣除账户余额这两步操作。中间一旦出现什么问题（网络中断、断电等），就可能出现商品库存没减少，但是用户的钱却被扣了。

事务通过ACID四大特性来兜底：

### 原子性

事务是不可分割的最小单元，事务内的操作要么全部成功提交，要么全部失败回滚

### 一致性

事务执行前后，数据库从一个合法一致状态变换到另一个合法一致状态，数据完整性约束不会改变

### 隔离性

多个并发执行的事务之间互相隔离，一个事务的修改在提交前，对其他事务不可见。

### 持久性

事务一旦提交成功，对数据库的修改就是永久保存的，即使系统崩溃，修改后的数据也不会丢失

## 分布式事务

那分布式事务是什么呢？我们知道，在微服务架构中，不同服务独立部署，拥有独立的数据库，那如果出现跨服务的操作，那怎么保证数据的一致性呢？这个时候就需要分布式事务了。我们以seata这个阿里开源的使用最广泛的分布式事务框架为例

在seata框架中有三个角色，TC，TM，RM。

### TC（Transaction Coordinator） 事务协调者

TC是seata的总指挥，通常以Seata Serve的形式独立部署。

它主要做三件事：

- 生成XID：开启全局事务时，TC生成全局唯一的事务ID；

- 登记分支事务：每个RM执行本地事务时，会把分支事务注册到TC；

- 驱动提交或回滚：TM决议后，TC通知所有RM完成分支提交或回滚；

TC本身不直接修改业务数据，它更像是状态管理中心。

### TM（Transaction Manager）事务管理器

TM是全局事务的发起者，通常位于调用链路的入口服务处，比如创建订单。

``` java
@Override
    @GlobalTransactional
    public Long createOrder(OrderFormDTO orderFormDTO) {
        // 1.订单数据
        Order order = new Order();
        // 1.1.查询商品
        List<OrderDetailDTO> detailDTOS = orderFormDTO.getDetails();
        // 1.2.获取商品id和数量的Map
        Map<Long, Integer> itemNumMap = detailDTOS.stream()
                .collect(Collectors.toMap(OrderDetailDTO::getItemId, OrderDetailDTO::getNum));
        Set<Long> itemIds = itemNumMap.keySet();
        // 1.3.查询商品
        List<ItemDTO> items = itemClient.queryItemByIds(itemIds);
        if (items == null || items.size() < itemIds.size()) {
            throw new BadRequestException("商品不存在");
        }
        // 1.4.基于商品价格、购买数量计算商品总价：totalFee
        int total = 0;
        for (ItemDTO item : items) {
            total += item.getPrice() * itemNumMap.get(item.getId());
        }
        order.setTotalFee(total);
        // 1.5.其它属性
        order.setPaymentType(orderFormDTO.getPaymentType());
        order.setUserId(UserContext.getUser());
        order.setStatus(1);
        // 1.6.将Order写入数据库order表中
        save(order);

        // 2.保存订单详情
        List<OrderDetail> details = buildDetails(order.getId(), items, itemNumMap);
        detailService.saveBatch(details);

        // 3.清理购物车商品
        cartClient.deleteCartItemByIds(itemIds);

        // 4.扣减库存
        try {
            itemClient.deductStock(detailDTOS);
        } catch (Exception e) {
            throw new RuntimeException("库存不足！");
        }
        return order.getId();
    }
```

以上这段代码所在的服务就可以称之为TM

TM主要负责：

- 向TC开启全局事务

- 在微服务调用链中传递XID

- 根据业务执行结果，向TC发起全局提交或全局回滚

### RM（Resource Mananger）资源管理器

RM是真正接触数据的一方，通常嵌入在每个需要真正参与分布式事务的微服务里

它负责：

- 管理本地数据资源，比如数据库连接；

- 执行本地事务；

- 向TC注册分支事务

- 接受TC的指令，完成分支提交和回滚

## 它们怎么协作？

一次典型的seata分布式流程是这样的：

1. TM向TC开启全局事务，获得XID；

2. XID在微服务调用链中传递；

3. 每个参与服务的RM接收XID，并向TC注册分支事务

4. 业务执行完成后，TM告诉TC提交或者回滚

5. TC通知所有的RM完成对应分支事务的提交或回滚

seata提供了四种不同的分布式事务解决方案：

- XA

- TCC

- AT

- SAGA

我们以XA模式和AT模式为例

## XA模式

基本架构如图：
![SA架构图](/images/distributed-transaction/SA.png)
XA模式的实现基于两阶段提交原理（Two-Phase Commit），简称2PC

### 一阶段：准备(Prepare)

在一阶段中，RM先注册分支事务到TC，然后执行业务SQL但不提交，TC发送Prpare信号，RM报告执行情况。

协调者：你能保证提交这笔事务吗？
  ├── 订单库：已准备好，可以提交
  ├── 购物车库：已准备好，可以提交
  └── 商品库：已准备好，可以提交

“准备好”意味着数据库已经可靠地记录了事务状态，承诺之后能够按照最终指令提交或回滚。它通常还会继续持有必要的锁。

因此，即使数据库在回复后重启，也应能够找回这个已准备的事务。

### 二阶段：决定（Commit/Rollback）

TC收集第一阶段各分支事务执行结果

- 若全部成功，则提交

- 若有一个失败，则回滚

### XA模式的优缺点

- 事务的强一致性，满足ACID原则
- 常用数据库都支持，实现简单，无代码侵入
- 因为一阶段需要锁定数据库资源，影响并发
- 依赖关系型数据库实现事务

## AT模式

AT模式的基本架构如图：

![AT架构图](/images/distributed-transaction/AT.png)

### 一阶段：执行业务，并记录回滚日志

1. TM先注册全局事务到TC
2. TM执行分支事务
3. 分支事务准备执行业务SQL
4. RM拦截业务SQL，根据where条件查询原始数据，形成快照。
5. RM执行业务SQL，提交本地事务，释放数据库锁。
6. RM报告本地事务状态给TC

### 二阶段

1. TM通知TC事务事务结束
2. TC检查分支事务状态
  a.如果都成功，则立即删除快照
  b.如果有分支事务失败，需要回滚。读取快照数据，将快照恢复到数据库。

## XA与AT的区别

- XA模式一阶段不提交事务，锁定资源；AT模式一阶段直接提交，不锁定资源。
- XA模式依赖数据库机制实现回滚；AT模式利用数据快照实现数据回滚。
- XA模式强一致；AT模式最终一致

可见，AT模式使用起来更加简单，无业务侵入，性能更好。因此企业90%的分布式事务都可以用AT模式来解决。
