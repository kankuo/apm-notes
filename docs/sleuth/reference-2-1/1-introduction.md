---
title: Sleuth（一）基本介绍
date: 2020-01-16
---

Spring Cloud Sleuth是为[Spring Cloud](https://cloud.spring.io/)实现的一套分布式消息追踪的解决方案。

## 1.1. 术语

Spring Cloud Sleuth基本沿用[Dapper](https://research.google/pubs/pub36356/)的术语。

**Span：** 是消息记录的最基本单元。例如发送一个RPC调用就是一个新的span，发送一个RPC的响应也是一个span。Span用一个64位的唯一ID来标识，一个span从属于一个trace，每个trace也是用64位的ID来标识。一个span还会有其它一些属性，例如描述、带有时间戳的事件、自定义键值对（也叫作tag），发起这个span的父span的ID，进程的标识（一般是IP地址）。

Span能够被启动和停止，并且自己维护时序信息，一旦创建了Span，就必须在未来某个时间点显式停止。

::: tip
发起trace之后的第一个span叫做`root span`。`spanId`的值等于`traceId`。
:::

**Trace：** 一系列span形成的树型结构。例如如果在运行一个分布式的数据存储，一个trace可能就是一个PUT请求的全过程。

**Annotation：** 用于记录某个时间的一个事件。借助[Brave](https://github.com/openzipkin/brave)组件库，不需要去刻意生成`Zipkin`能理解的事件，出于学习的目的，这里简单介绍这些事件，来帮助理解一个Span过程发生了哪些事情。

* **cs:** Client Sent. 表示Client端发起一个请求的时间戳，这是Span的起点；
* **sr:** Server Received: Server端收到请求并开始处理的时间戳，减去`cs`就是网络延迟；
* **ss:** Server Sent. 请求处理完成，开始向Client端发送响应的时间戳，减去`sr`表示服务端处理请求的时间；
* **cr:** Client Received. Client端成功收到服务端响应的时间，这是一个span的结束时间，减去`cs`表示客户端等待服务端响应的延时。

下图展示了Span和Trace在系统中大概是什么样子，以及Zipkin的annotation:

![Trace Info propagation](https://raw.githubusercontent.com/spring-cloud/spring-cloud-sleuth/master/docs/src/main/asciidoc/images/trace-id.png)

每个颜色就代表一个span （总共有A-G 7个span）。看一下这个标注：

    Trace Id = X
    Span Id = D
    Client Sent

这就是说traceId是X，spanId是D，当前状态是Client端向服务端发送请求。

下图展示了span之间的父子关系大概是个什么样子：

![Parent child relationship](https://raw.githubusercontent.com/spring-cloud/spring-cloud-sleuth/master/docs/src/main/asciidoc/images/parents.png)

## 1.2. 目标

以下各部分使用前面图中展示的调用关系为例（只看和RPC相关的几个，也就是去掉C、E、G三个span）。

### 1.2.1. 和Zipkin集成做分布式追踪

如果集成zipkin到zipkin的UI去看，能看到下图的样子，这里面有两个trace，按时间倒序排列的，先有一个成功的调用，有7个span，还有一个失败的调用，这个失败的调用总共收到6个span的上报：

![Traces](https://raw.githubusercontent.com/spring-cloud/spring-cloud-sleuth/master/docs/src/main/asciidoc/images/zipkin-traces.png)

这7个span分别是：

1. `service1`上报的`SpanId=A`的span，标注为`sr`和`ss`
2. `service1`上报的`SpanId=B`的span，标注为`cs`和`cr`
3. `service2`上报的`SpanId=B`的span，标注为`sr`和`ss`
4. `service2`上报的`SpanId=D`的span，标注为`cs`和`cr`
5. `service3`上报的`SpanId=D`的span，标注为`sr`和`ss`
6. `service2`上报的`SpanId=F`的span，标注为`cs`和`cr`
7. `service4`上报的`SpanId=F`的span，标注为`sr`和`ss`

如果点进具体的trace，会发现只有4个span：

![Traces Info propagation](https://raw.githubusercontent.com/spring-cloud/spring-cloud-sleuth/master/docs/src/main/asciidoc/images/zipkin-ui.png)

::: tip
打开具体的trace，看到的是合并之后的span，发送给zipkin的两个span，一个有`sr`（Server Received）和`ss`（Server Sent），一个有`cr`（Client Received）和`cs`（Client Sent），那么他们会被认为是同一个span。
:::

具体来看，在这种情况下，为什么有7个span和4个span的区别。

* 一个span来自`http:/start`的span。它具有服务器已接收（`sr`）和服务器已发送（`ss`）两个标注；
* 从`service1`到`service2` `http:/foo`接口的RPC调用产生了两个span。客户端已发送（`cs`）和客户端已接收（`cr`）在`service1`端发生。服务器已接收（`sr`）和服务器已发送（`ss`）在`service2`端发生。这两个span形成了与RPC调用相关的单个逻辑span；
* 从`service2`到`service3` `http:/bar`接口的RPC调用产生了两个span。客户端已发送（`cs`）和客户端已接收（`cr`）在`service2`端发生。服务器已接收（`sr`）和服务器已发送（`ss`）在`service3`端发生。这两个span形成了与RPC调用相关的单个逻辑span；
* 从`service2`到`service4` `http:/baz`接口的RPC调用产生了两个span。客户端已发送（`cs`）和客户端已接收（`cr`）在`service2`端发生。服务器已接收（`sr`）和服务器已发送（`ss`）在`service4`端发生。这两个span形成了与RPC调用相关的单个逻辑span；

因此，如果我们计算物理span，则有一个来自`http:/start`，两个来自`service1`调用`service2`，两个来自`service2`调用`service3`，以及两个来自`service2`调用`service4`。这样就有7个span。

从逻辑上说，只有4个span，有一个span与对`service1`的传入请求有关，三个与RPC调用有关。

### 1.2.2. 可视化的错误

通过Zipkin可以看到trace中的错误。当出现了没有被catch的异常，sleuth会在span上设置合适的tag，让Zipkin能够用不同的颜色来展示。例如`service4`挂掉了，就会出现前面图中展示的红色的trace。

点开trace详情，可以看到类似这样的界面：

![Error Traces](https://raw.githubusercontent.com/spring-cloud/spring-cloud-sleuth/master/docs/src/main/asciidoc/images/zipkin-error-traces.png)

点击一个红色的span，例如`service2`，会看到：

![Error Traces Info propagation](https://raw.githubusercontent.com/spring-cloud/spring-cloud-sleuth/master/docs/src/main/asciidoc/images/zipkin-error-trace-screenshot.png)

这里会展示出错原因和全部的trace栈。注意`service2`调用`service4`出现了未捕获的异常，但`service2`响应`service1`的`ss`还是会有，这条trace是6个span而不是7个，是因为`service4`挂掉了，相关的`sr`和`ss`没有上报。

### 1.2.3. 利用Brave做分布式追踪

`2.0.0`版本开始, `Spring Cloud Sleuth`使用[Brave](https://github.com/openzipkin/brave)作为追踪库，同时，`Sleuth`也不再关心trace context的维护，一律委托给Brave。

由于Sleuth有和Brave不同的命名和tag约定，以后会逐渐follow Brave的约定，如果还想按照以前Sleuth的方法用，可以设置`spring.sleuth.http.legacy.enabled=true`。

### 1.2.4. 在线演示

[在线演示](https://docssleuth-zipkin-server.cfapps.io/zipkin/)

笔者注：这个在线演示我没闹明白怎么用，好像只是放了一个zipkin的界面，没有调用的记录，我后面会自己搭一个，如果这里还没有更新，联系`zhfchdev@gmail.com`。

在Zipkin可以看到组装之后的服务依赖图：

![Dependencies](https://raw.githubusercontent.com/spring-cloud/spring-cloud-sleuth/master/docs/src/main/asciidoc/images/dependencies.png)

### 1.2.5. 日志关联

按照traceId去grep这4个服务的日志，可以看到这样的输出:

    service1.log:2016-02-26 11:15:47.561  INFO [service1,2485ec27856c56f4,2485ec27856c56f4,true] 68058 --- [nio-8081-exec-1] i.s.c.sleuth.docs.service1.Application   : Hello from service1. Calling service2
    service2.log:2016-02-26 11:15:47.710  INFO [service2,2485ec27856c56f4,9aa10ee6fbde75fa,true] 68059 --- [nio-8082-exec-1] i.s.c.sleuth.docs.service2.Application   : Hello from service2. Calling service3 and then service4
    service3.log:2016-02-26 11:15:47.895  INFO [service3,2485ec27856c56f4,1210be13194bfe5,true] 68060 --- [nio-8083-exec-1] i.s.c.sleuth.docs.service3.Application   : Hello from service3
    service2.log:2016-02-26 11:15:47.924  INFO [service2,2485ec27856c56f4,9aa10ee6fbde75fa,true] 68059 --- [nio-8082-exec-1] i.s.c.sleuth.docs.service2.Application   : Got response from service3 [Hello from service3]
    service4.log:2016-02-26 11:15:48.134  INFO [service4,2485ec27856c56f4,1b1845262ffba49d,true] 68061 --- [nio-8084-exec-1] i.s.c.sleuth.docs.service4.Application   : Hello from service4
    service2.log:2016-02-26 11:15:48.156  INFO [service2,2485ec27856c56f4,9aa10ee6fbde75fa,true] 68059 --- [nio-8082-exec-1] i.s.c.sleuth.docs.service2.Application   : Got response from service4 [Hello from service4]
    service1.log:2016-02-26 11:15:48.182  INFO [service1,2485ec27856c56f4,2485ec27856c56f4,true] 68058 --- [nio-8081-exec-1] i.s.c.sleuth.docs.service1.Application   : Got response from service2 [Hello from service2, response from service3 [Hello from service3] and from service4 [Hello from service4]]

如果有类似于Kibana或Splunk的日志聚合工具，能够按照事件发生顺序排序，下面是一个用Kibana的例子：

![Log correlation with Kibana](https://raw.githubusercontent.com/spring-cloud/spring-cloud-sleuth/master/docs/src/main/asciidoc/images/kibana.png)

想用Logstash的话，下面是Grok的pattern：

    filter {
        # pattern matching logback pattern
        grok {
            match => { "message" => "%{TIMESTAMP_ISO8601:timestamp}\s+%{LOGLEVEL:severity}\s+\[%{DATA:service},%{DATA:trace},%{DATA:span},%{DATA:exportable}\]\s+%{DATA:pid}\s+---\s+\[%{DATA:thread}\]\s+%{DATA:class}\s+:\s+%{GREEDYDATA:rest}" }
        }
    }

::: tip
如果想用Grok处理从Cloud Foundry拿到的日志，应该用下面的pattern：
:::

    filter {
        # pattern matching logback pattern
        grok {
            match => { "message" => "(?m)OUT\s+%{TIMESTAMP_ISO8601:timestamp}\s+%{LOGLEVEL:severity}\s+\[%{DATA:service},%{DATA:trace},%{DATA:span},%{DATA:exportable}\]\s+%{DATA:pid}\s+---\s+\[%{DATA:thread}\]\s+%{DATA:class}\s+:\s+%{GREEDYDATA:rest}" }
        }
    }

#### JSON Logback with Logstash

上面的日志是以文本形式输出到日志文件的，如果想保存成json文件，方便logstash收集，可以按照下面的步骤来：

##### 添加依赖

确保项目里依赖了Logback（`ch.qos.logback:logback-core`）。

添加`logstash-logback-encoder`，例如`4.6`版额：`net.logstash.logback:logstash-logback-encoder:4.6`。

##### 配置Logback

这是一个Logback配置文件的例子（在[logback-spring.xml](https://github.com/spring-cloud-samples/sleuth-documentation-apps/blob/master/service1/src/main/resources/logback-spring.xml)）。

    <?xml version="1.0" encoding="UTF-8"?>
    <configuration>
        <include resource="org/springframework/boot/logging/logback/defaults.xml"/>
        ​
        <springProperty scope="context" name="springAppName" source="spring.application.name"/>
        <!-- Example for logging into the build folder of your project -->
        <property name="LOG_FILE" value="${BUILD_FOLDER:-build}/${springAppName}"/>​

        <!-- You can override this to have a custom pattern -->
        <property name="CONSOLE_LOG_PATTERN"
                  value="%clr(%d{yyyy-MM-dd HH:mm:ss.SSS}){faint} %clr(${LOG_LEVEL_PATTERN:-%5p}) %clr(${PID:- }){magenta} %clr(---){faint} %clr([%15.15t]){faint} %clr(%-40.40logger{39}){cyan} %clr(:){faint} %m%n${LOG_EXCEPTION_CONVERSION_WORD:-%wEx}"/>

        <!-- Appender to log to console -->
        <appender name="console" class="ch.qos.logback.core.ConsoleAppender">
            <filter class="ch.qos.logback.classic.filter.ThresholdFilter">
                <!-- Minimum logging level to be presented in the console logs-->
                <level>DEBUG</level>
            </filter>
            <encoder>
                <pattern>${CONSOLE_LOG_PATTERN}</pattern>
                <charset>utf8</charset>
            </encoder>
        </appender>

        <!-- Appender to log to file -->​
        <appender name="flatfile" class="ch.qos.logback.core.rolling.RollingFileAppender">
            <file>${LOG_FILE}</file>
            <rollingPolicy class="ch.qos.logback.core.rolling.TimeBasedRollingPolicy">
                <fileNamePattern>${LOG_FILE}.%d{yyyy-MM-dd}.gz</fileNamePattern>
                <maxHistory>7</maxHistory>
            </rollingPolicy>
            <encoder>
                <pattern>${CONSOLE_LOG_PATTERN}</pattern>
                <charset>utf8</charset>
            </encoder>
        </appender>
        ​
        <!-- Appender to log to file in a JSON format -->
        <appender name="logstash" class="ch.qos.logback.core.rolling.RollingFileAppender">
            <file>${LOG_FILE}.json</file>
            <rollingPolicy class="ch.qos.logback.core.rolling.TimeBasedRollingPolicy">
                <fileNamePattern>${LOG_FILE}.json.%d{yyyy-MM-dd}.gz</fileNamePattern>
                <maxHistory>7</maxHistory>
            </rollingPolicy>
            <encoder class="net.logstash.logback.encoder.LoggingEventCompositeJsonEncoder">
                <providers>
                    <timestamp>
                        <timeZone>UTC</timeZone>
                    </timestamp>
                    <pattern>
                        <pattern>
                            {
                            "severity": "%level",
                            "service": "${springAppName:-}",
                            "trace": "%X{X-B3-TraceId:-}",
                            "span": "%X{X-B3-SpanId:-}",
                            "parent": "%X{X-B3-ParentSpanId:-}",
                            "exportable": "%X{X-Span-Export:-}",
                            "pid": "${PID:-}",
                            "thread": "%thread",
                            "class": "%logger{40}",
                            "rest": "%message"
                            }
                        </pattern>
                    </pattern>
                </providers>
            </encoder>
        </appender>
        ​
        <root level="INFO">
            <appender-ref ref="console"/>
            <!-- uncomment this to have also JSON logs -->
            <!--<appender-ref ref="logstash"/>-->
            <!--<appender-ref ref="flatfile"/>-->
        </root>
    </configuration>

That Logback configuration file:

Logs information from the application in a JSON format to a build/${spring.application.name}.json file.

Has commented out two additional appenders: console and standard log file.

Has the same logging pattern as the one presented in the previous section.

::: tips
If you use a custom logback-spring.xml, you must pass the spring.application.name in the bootstrap rather than the application property file. Otherwise, your custom logback file does not properly read the property.
:::

1.2.6. Propagating Span Context

The span context is the state that must get propagated to any child spans across process boundaries. Part of the Span Context is the Baggage. The trace and span IDs are a required part of the span context. Baggage is an optional part.

Baggage is a set of key:value pairs stored in the span context. Baggage travels together with the trace and is attached to every span. Spring Cloud Sleuth understands that a header is baggage-related if the HTTP header is prefixed with baggage- and, for messaging, it starts with baggage_.

::: warning
There is currently no limitation of the count or size of baggage items. However, keep in mind that too many can decrease system throughput or increase RPC latency. In extreme cases, too much baggage can crash the application, due to exceeding transport-level message or header capacity.
:::

The following example shows setting baggage on a span:

    Span initialSpan = this.tracer.nextSpan().name("span").start();
    ExtraFieldPropagation.set(initialSpan.context(), "foo", "bar");
    ExtraFieldPropagation.set(initialSpan.context(), "UPPER_CASE", "someValue");

##### Baggage versus Span Tags
Baggage travels with the trace (every child span contains the baggage of its parent). Zipkin has no knowledge of baggage and does not receive that information.


::: warning
Starting from Sleuth 2.0.0 you have to pass the baggage key names explicitly in your project configuration. Read more about that setup here
:::

Tags are attached to a specific span. In other words, they are presented only for that particular span. However, you can search by tag to find the trace, assuming a span having the searched tag value exists.

If you want to be able to lookup a span based on baggage, you should add a corresponding entry as a tag in the root span.

::: warning
The span must be in scope.
:::

The following listing shows integration tests that use baggage:

The setup

    spring.sleuth:
      baggage-keys:
        - baz
        - bizarrecase
      propagation-keys:
        - foo
        - upper_case

The code

    initialSpan.tag("foo",
            ExtraFieldPropagation.get(initialSpan.context(), "foo"));
    initialSpan.tag("UPPER_CASE",
            ExtraFieldPropagation.get(initialSpan.context(), "UPPER_CASE"));

1.3. Adding Sleuth to the Project

This section addresses how to add Sleuth to your project with either Maven or Gradle.

To ensure that your application name is properly displayed in Zipkin, set the spring.application.name property in bootstrap.yml.
1.3.1. Only Sleuth (log correlation)

If you want to use only Spring Cloud Sleuth without the Zipkin integration, add the spring-cloud-starter-sleuth module to your project.

The following example shows how to add Sleuth with Maven:

MavenGradle
<dependencyManagement> 
      <dependencies>
          <dependency>
              <groupId>org.springframework.cloud</groupId>
              <artifactId>spring-cloud-dependencies</artifactId>
              <version>${release.train.version}</version>
              <type>pom</type>
              <scope>import</scope>
          </dependency>
      </dependencies>
</dependencyManagement>

<dependency> 
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-sleuth</artifactId>
</dependency>
We recommend that you add the dependency management through the Spring BOM so that you need not manage versions yourself.
Add the dependency to spring-cloud-starter-sleuth.
The following example shows how to add Sleuth with Gradle:

1.3.2. Sleuth with Zipkin via HTTP

If you want both Sleuth and Zipkin, add the spring-cloud-starter-zipkin dependency.

The following example shows how to do so for Maven:

MavenGradle
<dependencyManagement> 
      <dependencies>
          <dependency>
              <groupId>org.springframework.cloud</groupId>
              <artifactId>spring-cloud-dependencies</artifactId>
              <version>${release.train.version}</version>
              <type>pom</type>
              <scope>import</scope>
          </dependency>
      </dependencies>
</dependencyManagement>

<dependency> 
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-zipkin</artifactId>
</dependency>
We recommend that you add the dependency management through the Spring BOM so that you need not manage versions yourself.
Add the dependency to spring-cloud-starter-zipkin.
The following example shows how to do so for Gradle:

1.3.3. Sleuth with Zipkin over RabbitMQ or Kafka

If you want to use RabbitMQ or Kafka instead of HTTP, add the spring-rabbit or spring-kafka dependency. The default destination name is zipkin.

If using Kafka, you must set the property spring.zipkin.sender.type property accordingly:

spring.zipkin.sender.type: kafka
spring-cloud-sleuth-stream is deprecated and incompatible with these destinations.
If you want Sleuth over RabbitMQ, add the spring-cloud-starter-zipkin and spring-rabbit dependencies.

The following example shows how to do so for Gradle:

Maven

    <dependencyManagement>  <!-- 1 -->
        <dependencies>
            <dependency>
                <groupId>org.springframework.cloud</groupId>
                <artifactId>spring-cloud-dependencies</artifactId>
                <version>${release.train.version}</version>
                <type>pom</type>
                <scope>import</scope>
            </dependency>
        </dependencies>
    </dependencyManagement>

    <dependency>  <!-- 2 -->
        <groupId>org.springframework.cloud</groupId>
        <artifactId>spring-cloud-starter-zipkin</artifactId>
    </dependency>
    <dependency>  <!-- 3 -->
        <groupId>org.springframework.amqp</groupId>
        <artifactId>spring-rabbit</artifactId>
    </dependency>

Gradle

    dependencyManagement {  // 1
        imports {
            mavenBom "org.springframework.cloud:spring-cloud-dependencies:${releaseTrainVersion}"
        }
    }

    dependencies {
        compile "org.springframework.cloud:spring-cloud-starter-zipkin"  // 2
        compile "org.springframework.amqp:spring-rabbit"   // 3
    }

We recommend that you add the dependency management through the Spring BOM so that you need not manage versions yourself.
Add the dependency to spring-cloud-starter-zipkin. That way, all nested dependencies get downloaded.
To automatically configure RabbitMQ, add the spring-rabbit dependency.
1.4. Overriding the auto-configuration of Zipkin

Spring Cloud Sleuth supports sending traces to multiple tracing systems as of version 2.1.0. In order to get this to work, every tracing system needs to have a Reporter<Span> and Sender. If you want to override the provided beans you need to give them a specific name. To do this you can use respectively ZipkinAutoConfiguration.REPORTER_BEAN_NAME and ZipkinAutoConfiguration.SENDER_BEAN_NAME.

    @Configuration
    protected static class MyConfig {

        @Bean(ZipkinAutoConfiguration.REPORTER_BEAN_NAME)
        Reporter<zipkin2.Span> myReporter() {
            return AsyncReporter.create(mySender());
        }

        @Bean(ZipkinAutoConfiguration.SENDER_BEAN_NAME)
        MySender mySender() {
            return new MySender();
        }

        static class MySender extends Sender {

            private boolean spanSent = false;

            boolean isSpanSent() {
                return this.spanSent;
            }

            @Override
            public Encoding encoding() {
                return Encoding.JSON;
            }

            @Override
            public int messageMaxBytes() {
                return Integer.MAX_VALUE;
            }

            @Override
            public int messageSizeInBytes(List<byte[]> encodedSpans) {
                return encoding().listSizeInBytes(encodedSpans);
            }

            @Override
            public Call<Void> sendSpans(List<byte[]> encodedSpans) {
                this.spanSent = true;
                return Call.create(null);
            }

        }

    }