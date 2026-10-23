---
title: 学习消息队列
date: 2026-10-23 15:01:00
categories: 技术笔记
tags:
  - 消息队列
  - 中间件
  - RabbitMQ
description: 记录RabbitMQ学习的感想和收获
---

## 同步调用

微服务一旦被拆分，必然涉及服务之间的相互调用。目前的项目中，我们都是基于OpenFeign的调用。这种调用中，调用者发起请求后需要等待服务提供者执行业务返回结果后，才能继续执行后面的业务。也就是调用者处于阻塞状态，称之为同步调用。这种做法有几种缺点：

- 拓展性差
- 性能下降
- 级联失败

## 异步调用

所以在很多场景下我们要采用异步调用的方式。

异步调用基于消息通知的方式，一般包含是三个角色：

- 消息发送者：即服务调用方
- 消息Broker：管理、暂存、转发消息
- 消息接收者：即服务提供方

在异步调用中服务调用方不再同步调用接收者的业务接口，转而发送一条信息给消息Broker，然后接受者根据需求订阅消息。

这样，两者就实现了解耦。

异步调用有以下优缺点；

- 耦合度低
- 性能更好
- 业务拓展性强
- 故障隔离，避免级联失败

- 完全依赖Broker的可靠性、安全性和性能
- 架构复杂，后期维护和调试麻烦

## 技术选型

目前主流的消息Broker的实现方案就是消息队列，（Message Queue），简称MQ。

目前常见的MQ实现：

- RabbitMQ
- RocketMQ
- ActiveMQ
- Kafka

综合使用的广泛程度，我们学习RabbitMQ

## RabbitMQ

RabbitMQ的架构如图：

![RabbitMQ](/images/rabbitmq/rabbitmq.png)

其中有几个关键的概念：

- **publisher**: 生产者，即发送消息一方
- **consumer**：消费者，即接收消息一方
- **queue**:队列，存储消息。生产者投递的消息会暂存在消息队列中，等待消费者处理
- **exchange**:交换机，负责消息路由生产者发送的消息又交换机决定发送到哪个队列
- **virtual host**：虚拟主机，起数据隔离的作用。每个virtual host有各自独立的exchange和queue

### Work Queues模型

![Work Queue](/images/rabbitmq/work-queue.png)

Work Queues任务模型，简单来说就是多个消费者绑定同一个队列，共同消费队列中的消息以提高消息处理的速度

默认情况下，消息是平均分给每个消费者的，这样没有充分考虑消费者的处理能力，导致有时候任务耗时变长。

我们可以通过在applicaton.yaml文件中进行设置，让消费者每次只能获取一条消息，处理完成才能接着获取来提高效率

```YAML
spring:
  rabbitmq:
    listener:
      simple:
        prefetch: 1 # 每次只能获取一条消息，处理完成才能获取下一个消息
```

### 交换机类型

交换机的类型有四种：

- **Fanout**:广播，将消息交给绑定到交换机的所以队列
- **Direct**：订阅。基于RoutingKey（路由key）发送给订阅了消息的队列
- **Topic**：通配符订阅，与direct类似，只不过RoutingKey可以使用通配符
- **Headers**：头匹配，基于MQ的消息头匹配用得较少

#### Fanout交换机

在广播模式下，消息发送流程是这样的：

![fanout交换机流程](/images/rabbitmq/fanout.png)

- 可以有多个队列
- 每个队列都要绑定到Exchange（交换机）
- 生产者发送的消息，只能发送到交换机
- 交换机把消息发送给绑定过的所有队列
- 订阅队列的消费者都能拿到消息

综上，我们可以知道，交换机的有以下特点：

- 接收publisher发送的消息
- 讲消息按照规则路由到与之绑定的队列
- 不能缓存消息，路由失败，消息丢失

#### Direct交换机

在Fanout模式中，一条消息，会被所有订阅的队列都消费。但是，在某些场景下，我们希望不同的消息被不同的队列消费。这时就要用到Direct类型的Exchange。

![Direct交换机流程](/images/rabbitmq/direct.png)

不难看出，在Direct模型下，队列不能任意绑定交换机了，而是必须指定一个RoutingKey,在发送消息是也必须指定这个key。exchange不再把消息发送到所有与之绑定的队列，只有两者的RoutingKey完全一致，队列才会接收到消息。

#### Topic交换机

Topic类型的Exchange与Direct相比，都是可以根据RoutingKey把消息路由到不同的队列。只不过Topic类型Exchange可以让队列在绑定BindingKey 的时候使用通配符

BindingKey 一般都是有一个或多个单词组成，多个单词之间以.分割，例如： item.insert

通配符规则：

- #：匹配一个或多个词
- *：匹配不多不少恰好1个词

![Topic交换机图示](/images/rabbitmq/topic.png)

### 消息转换器

Spring的消息发送代码接收的消息体是一个Object。

而在数据传输时，它会把你发送的消息序列化为字节发送给MQ，接收消息的时候，还会把字节反序列化为Java对象。

只不过，默认情况下Spring采用的序列化方式是JDK序列化。众所周知，JDK序列化存在下列问题：

- 数据体积过大
- 有安全漏洞
- 可读性差

为了解决这个问题，我们需要配置消息转换器，在publisher和consumer两个服务的启动类中添加一个Bean即可。

```java
@Bean
public MessageConverter messageConverter(){
    // 1.定义消息转换器
    Jackson2JsonMessageConverter jackson2JsonMessageConverter = new Jackson2JsonMessageConverter();
    // 2.配置自动创建消息id，用于识别不同消息，也可以在业务中基于ID判断是否是重复消息
    jackson2JsonMessageConverter.setCreateMessageIds(true);
    return jackson2JsonMessageConverter;
}
```

## 生产者的可靠性

消息从发送者发送消息，到消费者处理消息，需要经过的流程是这样的：

![消息发送流程](/images/rabbitmq/message-flow.png)

消息从生产者到消费者的每一步都可能导致消息丢失：

- 发送消息时丢失：
  - 生产者发送消息时连接MQ失败
  - 生产者发送消息到达MQ后未找到Exchange
  - 生产者发送消息到达MQ的Exchange后，未找到合适的Queue
  - 消息到达MQ后，处理消息的进程发生异常
- MQ导致消息丢失：
  - 消息到达MQ，保存到队列后，尚未消费就突然宕机
- 消费者处理消息时：
  - 消息接收后尚未处理突然宕机
  - 消息接收后处理过程中抛出异常

综上，我们要解决消息丢失问题，保证MQ的可靠性，就必须从3个方面入手：

- 确保生产者一定把消息发送到MQ
- 确保MQ不会将消息弄丢
- 确保消费者一定要处理消息

### 生产者重试机制

首先第一种情况，就是生产者发送消息时，出现了网络故障，导致与MQ的连接中断。

为了解决这个问题，SpringAMQP提供的消息发送时的重试机制。即：当RabbitTemplate与MQ连接超时后，多次重试。

我们可以通过修改**publisher**的**application.yaml**文件来开启这个功能：

```YAML
spring:
  rabbitmq:
    connection-timeout: 1s # 设置MQ的连接超时时间
    template:
      retry:
        enabled: true # 开启超时重试机制
        initial-interval: 1000ms # 失败后的初始等待时间
        multiplier: 1 # 失败后下次的等待时长倍数，下次等待时长 = initial-interval * multiplier
        max-attempts: 3 # 最大重试次数
```

**注意**：

当网络不稳定的时候，利用重试机制可以有效提高消息发送的成功率。不过SpringAMQP提供的重试机制是阻塞式的重试，也就是说多次重试等待的过程中，当前线程是被阻塞的。

如果对于业务性能有要求，建议禁用重试机制。如果一定要使用，请合理配置等待时长和重试次数，当然也可以考虑使用异步线程来执行发送消息的代码。

### 生产者确认机制

一般情况下，只要生产者与MQ之间的网路连接顺畅，基本不会出现发送消息丢失的情况，因此大多数情况下我们无需考虑这种问题。
不过，在少数情况下，也会出现消息发送到MQ之后丢失的现象，比如：

- MQ内部处理消息的进程发生了异常
- 生产者发送消息到达MQ后未找到Exchange
- 生产者发送消息到达MQ的Exchange后，未找到合适的Queue，因此无法路由

针对上述情况，RabbitMQ提供了生产者消息确认机制，包括Publisher Confirm和Publisher Return两种。在开启确认机制的情况下，当生产者发送消息给MQ后，MQ会根据消息处理的情况返回不同的回执。

具体如图：

![生产者确认流程](/images/rabbitmq/publiher-confirm.png)

可以看出：

- 当消息投递到MQ，但是路由失败时，通过Publisher Return返回异常信息，同时返回ack的确认信息，代表投递成功
- 临时消息投递到了MQ，并且入队成功，返回ACK，告知投递成功
- 持久消息投递到了MQ，并且入队完成持久化，返回ACK ，告知投递成功
- 其它情况都会返回NACK，告知投递失败

其中ack和nack属于Publisher Confirm机制，ack是投递成功；nack是投递失败。而return则属于Publisher Return机制。

默认两种机制都是关闭状态，需要通过配置文件来开启。

```YAML
spring:
  rabbitmq:
    publisher-confirm-type: correlated # 开启publisher confirm机制，并设置confirm类型
    publisher-returns: true # 开启publisher return机制
```

这里publisher-confirm-type有三种模式可选：

- none：关闭confirm机制
- simple：同步阻塞等待MQ的回执
- correlated：MQ异步回调返回回执

不难看出，我们推荐使用correlated

## MQ的可靠性

消息到达MQ以后，如果MQ不能及时保存，也会导致消息丢失，所以MQ的可靠性也非常重要。

### 数据持久化

为了提升性能，默认情况下MQ的数据都是在内存存储的临时数据，重启后就会消失。为了保证数据的可靠性，必须配置数据持久化，包括：

- 交换机持久化
- 队列持久化
- 消息持久化

以上均可以通过RabbitMQ控制台或者代码设置，此处不在过多赘述

### LazyQueue

在默认情况下，RabbitMQ会将接收到的信息保存在内存中以降低消息收发的延迟。但在某些特殊情况下，这会导致消息积压，比如：

- 消费者宕机或出现网络故障
- 消息发送量激增，超过了消费者处理速度
- 消费者处理业务发生阻塞

一旦出现消息堆积问题，RabbitMQ的内存占用就会越来越高，直到触发内存预警上限。此时RabbitMQ会将内存消息刷到磁盘上，这个行为成为PageOut. PageOut会耗费一段时间，并且会阻塞队列进程。因此在这个过程中RabbitMQ不会再处理新的消息，生产者的所有请求都会被阻塞。

为了解决这个问题，从RabbitMQ的3.6.0版本开始，就增加了Lazy Queues的模式，也就是惰性队列。惰性队列的特征如下：

- 接收到消息后直接存入磁盘而非内存
- 消费者要消费消息时才会从磁盘中读取并加载到内存（也就是懒加载）
- 支持数百万条的消息存储

## 消费者的可靠性：

当RabbitMQ向消费者投递消息以后，需要知道消费者的处理状态如何。因为消息投递给消费者并不代表就一定被正确消费了，可能出现的故障有很多，比如：

- 消息投递的过程中出现了网络故障
- 消费者接收到消息后突然宕机
- 消费者接收到消息后，因处理不当导致异常
- ...
一旦发生上述情况，消息也会丢失。因此，RabbitMQ必须知道消费者的处理状态，一旦消息处理失败才能重新投递消息。
但问题来了：RabbitMQ如何得知消费者的处理状态呢？

### 消费者确认机制

为了确认消费者是否成功处理消息，RabbitMQ提供了消费者确认机制（Consumer Acknowledgement）。即：当消费者处理消息结束后，应该向RabbitMQ发送一个回执，告知RabbitMQ自己消息处理状态。回执有三种可选值：

- ack：成功处理消息，RabbitMQ从队列中删除该消息
- nack：消息处理失败，RabbitMQ需要再次投递消息
- reject：消息处理失败并拒绝该消息，RabbitMQ从队列中删除该消息

一般reject方式用的较少，除非是消息格式有问题，那就是开发问题了。因此大多数情况下我们需要将消息处理的代码通过try catch机制捕获，消息处理成功时返回ack，处理失败时返回nack.

由于消息回执的处理代码比较统一，因此SpringAMQP帮我们实现了消息确认。并允许我们通过配置文件设置ACK处理方式，有三种模式：

- none：不处理。即消息投递给消费者后立刻ack，消息会立刻从MQ删除。非常不安全，不建议使用
- manual：手动模式。需要自己在业务代码中调用api，发送ack或reject，存在业务入侵，但更灵活
- auto：自动模式。SpringAMQP利用AOP对我们的消息处理逻辑做了环绕增强，当业务正常执行时则自动返回ack.  当业务出现异常时，根据异常判断返回不同结果：
  - 如果是业务异常，会自动返回nack；
  - 如果是消息处理或校验异常，自动返回reject;

## 业务幂等性

幂等是一个数学概念，用函数表达式来描述是这样的：**f(x) = f(f(x))**，例如求绝对值函数。
在程序开发中，则是指同一个业务，执行一次或多次对业务状态的影响是一致的。例如：

- 根据id删除数据
- 查询数据
- 新增数据

但数据的更新往往不是幂等的，如果重复执行可能造成不一样的后果。比如：

- 取消订单，恢复库存的业务。如果多次恢复就会出现库存重复增加的情况
- 退款业务。重复退款对商家而言会有经济损失。

所以，我们要尽可能避免业务被重复执行。
然而在实际业务场景中，由于意外经常会出现业务被重复执行的情况，例如：

- 页面卡顿时频繁刷新导致表单重复提交
- 服务间调用的重试
- MQ消息的重复投递

我们在用户支付成功后会发送MQ消息到交易服务，修改订单状态为已支付，就可能出现消息重复投递的情况。如果消费者不做判断，很有可能导致消息被消费多次，出现业务故障。

举例：

1. 假如用户刚刚支付完成，并且投递消息到交易服务，交易服务更改订单为已支付状态。
2. 由于某种原因，例如网络故障导致生产者没有得到确认，隔了一段时间后重新投递给交易服务。
3. 但是，在新投递的消息被消费之前，用户选择了退款，将订单状态改为了已退款状态。
4. 退款完成后，新投递的消息才被消费，那么订单状态会被再次改为已支付。业务异常。

因此，我们必须想办法保证消息处理的幂等性。这里给出两种方案：

- 唯一消息ID
- 业务状态判断

## 延迟消息

很多业务场景中，我们需要延时操作也就是延时任务，比如对于超过一定时间未支付的订单，应该立刻取消订单并释放占用的库存。MQ为我们提供了延迟消息来解决

在RabbitMQ中实现延迟消息有两种方案：

- 死信交换机+TTL
- 延迟消息插件

### 死信交换机

当一个队列中的消息满足下列情况之一时，可以成为死信（dead letter）：

- 消费者使用basic.reject或 basic.nack声明消费失败，并且消息的requeue参数设置为false
- 消息是一个过期消息，超时无人消费
- 要投递的队列消息满了，无法投递

简单来说就是无法被正确处理的消息

如果一个队列中的消息已经成为死信，并且这个队列通过dead-letter-exchange属性指定了一个交换机，那么队列中的死信就会投递到这个交换机中，而这个交换机就称为死信交换机（Dead Letter Exchange）。而此时加入有队列与死信交换机绑定，则最终死信就会被投递到这个队列中。

死信交换机有什么作用呢？

1. 收集那些因处理失败而被拒绝的消息
2. 收集那些因队列满了而被拒绝的消息
3. 收集因TTL（有效期）到期的消息

下图是通过死信交换机实现延迟消息的原理：

![死信交换机实现延迟消息](/images/rabbitmq/delay-message.png)

发送一条消息到ttl.fanout，RoutingKey为blue，并设置消息的有效期为5000毫秒。

消息肯定会被投递到ttl.queue之后，由于没有消费者，因此消息无人消费。5秒之后，消息的有效期到期，成为死信。

死信被再次投递到死信交换机hmall.direct，并沿用之前的RoutingKey，也就是blue

由于direct.queue1与hmall.direct绑定的key是blue，因此最终消息被成功路由到direct.queue1，如果此时有消费者与direct.queue1绑定， 也就能成功消费消息了。但此时已经是5秒钟以后了

也就是说，publisher发送了一条消息，但最终consumer在5秒后才收到消息。我们成功实现了延迟消息

### DelayExchange插件

基于死信队列虽然可以实现延迟消息，但是太麻烦了。因此RabbitMQ社区提供了一个延迟消息插件来实现相同的效果。

github地址为：[text](https://github.com/rabbitmq/rabbitmq-delayed-message-exchange)

不过值得一提的是，在撰写这篇博客的时候，RabbitMQ 4.4刚刚上线3天，其提供了 quorum queues ，原生支持延时消息，所以这个插件仓库已经停止维护了

## 在Java中使用RabbitMq

上面讲了很多理论的东西，我觉得有必要通过代码具体演示下java中使用RabbitMQ

 Spring AMQP提供了声明队列的queue类，和表示exchange的接口。

 我们需要在publisher中创建一个配置类，用来声明队列和交换机，将其注册为Bean，并交给IOC容器管理

 ```java
 package com.itheima.consumer.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.FanoutExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class FanoutConfig {
    /**
     * 声明交换机
     * @return Fanout类型交换机
     */
    @Bean
    public FanoutExchange fanoutExchange(){
        return new FanoutExchange("hmall.fanout");
    }

    /**
     * 第1个队列
     */
    @Bean
    public Queue fanoutQueue1(){
        return new Queue("fanout.queue1");
    }

    /**
     * 绑定队列和交换机
     */
    @Bean
    public Binding bindingQueue1(Queue fanoutQueue1, FanoutExchange fanoutExchange){
        return BindingBuilder.bind(fanoutQueue1).to(fanoutExchange);
    }

    /**
     * 第2个队列
     */
    @Bean
    public Queue fanoutQueue2(){
        return new Queue("fanout.queue2");
    }

    /**
     * 绑定队列和交换机
     */
    @Bean
    public Binding bindingQueue2(Queue fanoutQueue2, FanoutExchange fanoutExchange){
        return BindingBuilder.bind(fanoutQueue2).to(fanoutExchange);
    }
}
```

direct模式由于要绑定多个KEY，会非常麻烦，每一个Key都要编写一个binding,所以我们可以不使用@Bean方式来声明，选择注解来声明：

```java
package com.hmall.trade.listener;

import com.hmall.api.client.PayClient;
import com.hmall.common.constants.OrderStatus;
import com.hmall.common.enums.PayStatus;
import com.hmall.api.dto.PayOrderDTO;
import com.hmall.trade.constants.MQConstants;
import com.hmall.trade.domain.po.Order;
import com.hmall.trade.service.IOrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.amqp.rabbit.annotation.Exchange;
import org.springframework.amqp.rabbit.annotation.Queue;
import org.springframework.amqp.rabbit.annotation.QueueBinding;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class OrderDelayMessageListener {

    private final IOrderService orderService;
    private final PayClient payClient;

    @RabbitListener(bindings = @QueueBinding(
            value = @Queue(name = MQConstants.DELAY_ORDER_QUEUE_NAME),
            exchange = @Exchange(name = MQConstants.DELAY_EXCHANGE_NAME, delayed = "true"),
            key = MQConstants.DELAY_ORDER_KEY
    ))
    public void listenOrderDelayMessage(Long orderId){
        // 1.查询订单
        Order order = orderService.getById(orderId);
        // 2.检测订单状态，判断是否已支付
        if(order == null || order.getStatus() != OrderStatus.UNPAID){
            // 订单不存在或者已经支付
            return;
        }
        // 3.未支付，需要查询支付流水状态
        PayOrderDTO payOrder = payClient.queryPayOrderByBizOrderNo(orderId);
        // 4.判断是否支付
        if(payOrder != null && PayStatus.TRADE_SUCCESS.equalsValue(payOrder.getStatus())){
            // 4.1.已支付，标记订单状态为已支付
            orderService.markOrderPaySuccess(orderId);
        }else{
            orderService.cancelOrder(orderId);
        }
    }
}
```

Topic交换机同理，这里不再赘述

发送消息时，在生产者注入rabbitmq的客户端来使用如：

```java
try {
        rabbitTemplate.convertAndSend("pay.direct", "pay.success", po.getBizOrderNo());
    } catch (Exception e) {
        log.error("支付成功的消息发送失败，支付单id：{}， 交易单id：{}", po.getId(), po.getBizOrderNo(), e);
    }
```

接收消息时，则在消费者创建一个listener类来接收，详见前文direct交换机的相关代码
