Spring Cloud Sleuth is compatible with OpenTracing. If you have OpenTracing on the classpath, we automatically register the OpenTracing Tracer bean. If you wish to disable this, set spring.sleuth.opentracing.enabled to false

15.2. Runnable and Callable

If you wrap your logic in Runnable or Callable, you can wrap those classes in their Sleuth representative, as shown in the following example for Runnable:

Runnable runnable = new Runnable() {
    @Override
    public void run() {
        // do some work
    }

    @Override
    public String toString() {
        return "spanNameFromToStringMethod";
    }
};
// Manual `TraceRunnable` creation with explicit "calculateTax" Span name
Runnable traceRunnable = new TraceRunnable(this.tracing, spanNamer, runnable,
        "calculateTax");
// Wrapping `Runnable` with `Tracing`. That way the current span will be available
// in the thread of `Runnable`
Runnable traceRunnableFromTracer = this.tracing.currentTraceContext()
        .wrap(runnable);
The following example shows how to do so for Callable:

Callable<String> callable = new Callable<String>() {
    @Override
    public String call() throws Exception {
        return someLogic();
    }

    @Override
    public String toString() {
        return "spanNameFromToStringMethod";
    }
};
// Manual `TraceCallable` creation with explicit "calculateTax" Span name
Callable<String> traceCallable = new TraceCallable<>(this.tracing, spanNamer,
        callable, "calculateTax");
// Wrapping `Callable` with `Tracing`. That way the current span will be available
// in the thread of `Callable`
Callable<String> traceCallableFromTracer = this.tracing.currentTraceContext()
        .wrap(callable);
That way, you ensure that a new span is created and closed for each execution.

15.3. Spring Cloud CircuitBreaker

If you have Spring Cloud CircuitBreaker on the classpath, we will wrap the passed command Supplier and the fallback Function in its trace representations. In order to disable this instrumentation set spring.sleuth.circuitbreaker.enabled to false.

15.4. Hystrix

15.4.1. Custom Concurrency Strategy

We register a custom HystrixConcurrencyStrategy called TraceCallable that wraps all Callable instances in their Sleuth representative. The strategy either starts or continues a span, depending on whether tracing was already going on before the Hystrix command was called. Optionally, you can set spring.sleuth.hystrix.strategy.passthrough to true to just propagate the trace context to the Hystrix execution thread if you don’t wish to start a new span. To disable the custom Hystrix Concurrency Strategy, set the spring.sleuth.hystrix.strategy.enabled to false.

15.4.2. Manual Command setting

Assume that you have the following HystrixCommand:

HystrixCommand<String> hystrixCommand = new HystrixCommand<String>(setter) {
    @Override
    protected String run() throws Exception {
        return someLogic();
    }
};
To pass the tracing information, you have to wrap the same logic in the Sleuth version of the HystrixCommand, which is called TraceCommand, as shown in the following example:

TraceCommand<String> traceCommand = new TraceCommand<String>(tracer, setter) {
    @Override
    public String doRun() throws Exception {
        return someLogic();
    }
};
15.5. RxJava

We registering a custom RxJavaSchedulersHook that wraps all Action0 instances in their Sleuth representative, which is called TraceAction. The hook either starts or continues a span, depending on whether tracing was already going on before the Action was scheduled. To disable the custom RxJavaSchedulersHook, set the spring.sleuth.rxjava.schedulers.hook.enabled to false.

You can define a list of regular expressions for thread names for which you do not want spans to be created. To do so, provide a comma-separated list of regular expressions in the spring.sleuth.rxjava.schedulers.ignoredthreads property.

The suggest approach to reactive programming and Sleuth is to use the Reactor support.
15.6. HTTP integration

Features from this section can be disabled by setting the spring.sleuth.web.enabled property with value equal to false.

15.6.1. HTTP Filter

Through the TracingFilter, all sampled incoming requests result in creation of a Span. That Span’s name is http: + the path to which the request was sent. For example, if the request was sent to /this/that then the name will be http:/this/that. You can configure which URIs you would like to skip by setting the spring.sleuth.web.skipPattern property. If you have ManagementServerProperties on classpath, its value of contextPath gets appended to the provided skip pattern. If you want to reuse the Sleuth’s default skip patterns and just append your own, pass those patterns by using the spring.sleuth.web.additionalSkipPattern.

By default, all the spring boot actuator endpoints are automatically added to the skip pattern. If you want to disable this behaviour set spring.sleuth.web.ignore-auto-configured-skip-patterns to true.

To change the order of tracing filter registration, please set the spring.sleuth.web.filter-order property.

To disable the filter that logs uncaught exceptions you can disable the spring.sleuth.web.exception-throwing-filter-enabled property.

15.6.2. HandlerInterceptor

Since we want the span names to be precise, we use a TraceHandlerInterceptor that either wraps an existing HandlerInterceptor or is added directly to the list of existing HandlerInterceptors. The TraceHandlerInterceptor adds a special request attribute to the given HttpServletRequest. If the the TracingFilter does not see this attribute, it creates a "fallback" span, which is an additional span created on the server side so that the trace is presented properly in the UI. If that happens, there is probably missing instrumentation. In that case, please file an issue in Spring Cloud Sleuth.

15.6.3. Async Servlet support

If your controller returns a Callable or a WebAsyncTask, Spring Cloud Sleuth continues the existing span instead of creating a new one.

15.6.4. WebFlux support

Through TraceWebFilter, all sampled incoming requests result in creation of a Span. That Span’s name is http: + the path to which the request was sent. For example, if the request was sent to /this/that, the name is http:/this/that. You can configure which URIs you would like to skip by using the spring.sleuth.web.skipPattern property. If you have ManagementServerProperties on the classpath, its value of contextPath gets appended to the provided skip pattern. If you want to reuse Sleuth’s default skip patterns and append your own, pass those patterns by using the spring.sleuth.web.additionalSkipPattern.

To change the order of tracing filter registration, please set the spring.sleuth.web.filter-order property.

15.6.5. Dubbo RPC support

Via the integration with Brave, Spring Cloud Sleuth supports Dubbo. It’s enough to add the brave-instrumentation-dubbo dependency:

<dependency>
    <groupId>io.zipkin.brave</groupId>
    <artifactId>brave-instrumentation-dubbo</artifactId>
</dependency>
You need to also set a dubbo.properties file with the following contents:

dubbo.provider.filter=tracing
dubbo.consumer.filter=tracing
You can read more about Brave - Dubbo integration here. An example of Spring Cloud Sleuth and Dubbo can be found here.

15.7. HTTP Client Integration

15.7.1. Synchronous Rest Template

We inject a RestTemplate interceptor to ensure that all the tracing information is passed to the requests. Each time a call is made, a new Span is created. It gets closed upon receiving the response. To block the synchronous RestTemplate features, set spring.sleuth.web.client.enabled to false.

You have to register RestTemplate as a bean so that the interceptors get injected. If you create a RestTemplate instance with a new keyword, the instrumentation does NOT work.
15.7.2. Asynchronous Rest Template

Starting with Sleuth 2.0.0, we no longer register a bean of AsyncRestTemplate type. It is up to you to create such a bean. Then we instrument it.
To block the AsyncRestTemplate features, set spring.sleuth.web.async.client.enabled to false. To disable creation of the default TraceAsyncClientHttpRequestFactoryWrapper, set spring.sleuth.web.async.client.factory.enabled to false. If you do not want to create AsyncRestClient at all, set spring.sleuth.web.async.client.template.enabled to false.

Multiple Asynchronous Rest Templates
Sometimes you need to use multiple implementations of the Asynchronous Rest Template. In the following snippet, you can see an example of how to set up such a custom AsyncRestTemplate:

@Configuration
@EnableAutoConfiguration
static class Config {

    @Bean(name = "customAsyncRestTemplate")
    public AsyncRestTemplate traceAsyncRestTemplate() {
        return new AsyncRestTemplate(asyncClientFactory(),
                clientHttpRequestFactory());
    }

    private ClientHttpRequestFactory clientHttpRequestFactory() {
        ClientHttpRequestFactory clientHttpRequestFactory = new CustomClientHttpRequestFactory();
        // CUSTOMIZE HERE
        return clientHttpRequestFactory;
    }

    private AsyncClientHttpRequestFactory asyncClientFactory() {
        AsyncClientHttpRequestFactory factory = new CustomAsyncClientHttpRequestFactory();
        // CUSTOMIZE HERE
        return factory;
    }

}
15.7.3. WebClient

We inject a ExchangeFilterFunction implementation that creates a span and, through on-success and on-error callbacks, takes care of closing client-side spans.

To block this feature, set spring.sleuth.web.client.enabled to false.

You have to register WebClient as a bean so that the tracing instrumentation gets applied. If you create a WebClient instance with a new keyword, the instrumentation does NOT work.
15.7.4. Traverson

If you use the Traverson library, you can inject a RestTemplate as a bean into your Traverson object. Since RestTemplate is already intercepted, you get full support for tracing in your client. The following pseudo code shows how to do that:

@Autowired RestTemplate restTemplate;

Traverson traverson = new Traverson(URI.create("https://some/address"),
    MediaType.APPLICATION_JSON, MediaType.APPLICATION_JSON_UTF8).setRestOperations(restTemplate);
// use Traverson
15.7.5. Apache HttpClientBuilder and HttpAsyncClientBuilder

We instrument the HttpClientBuilder and HttpAsyncClientBuilder so that tracing context gets injected to the sent requests.

To block these features, set spring.sleuth.web.client.enabled to false.

15.7.6. Netty HttpClient

We instrument the Netty’s HttpClient.

To block this feature, set spring.sleuth.web.client.enabled to false.

You have to register HttpClient as a bean so that the instrumentation happens. If you create a HttpClient instance with a new keyword, the instrumentation does NOT work.
15.7.7. UserInfoRestTemplateCustomizer

We instrument the Spring Security’s UserInfoRestTemplateCustomizer.

To block this feature, set spring.sleuth.web.client.enabled to false.

15.8. Feign

By default, Spring Cloud Sleuth provides integration with Feign through TraceFeignClientAutoConfiguration. You can disable it entirely by setting spring.sleuth.feign.enabled to false. If you do so, no Feign-related instrumentation take place.

Part of Feign instrumentation is done through a FeignBeanPostProcessor. You can disable it by setting spring.sleuth.feign.processor.enabled to false. If you set it to false, Spring Cloud Sleuth does not instrument any of your custom Feign components. However, all the default instrumentation is still there.

15.9. gRPC

Spring Cloud Sleuth provides instrumentation for gRPC through TraceGrpcAutoConfiguration. You can disable it entirely by setting spring.sleuth.grpc.enabled to false.

15.9.1. Variant 1

Dependencies
The gRPC integration relies on two external libraries to instrument clients and servers and both of those libraries must be on the class path to enable the instrumentation.
Maven:

        <dependency>
            <groupId>io.github.lognet</groupId>
            <artifactId>grpc-spring-boot-starter</artifactId>
        </dependency>
        <dependency>
            <groupId>io.zipkin.brave</groupId>
            <artifactId>brave-instrumentation-grpc</artifactId>
        </dependency>
Gradle:

    compile("io.github.lognet:grpc-spring-boot-starter")
    compile("io.zipkin.brave:brave-instrumentation-grpc")
Server Instrumentation
Spring Cloud Sleuth leverages grpc-spring-boot-starter to register Brave’s gRPC server interceptor with all services annotated with @GRpcService.

Client Instrumentation
gRPC clients leverage a ManagedChannelBuilder to construct a ManagedChannel used to communicate to the gRPC server. The native ManagedChannelBuilder provides static methods as entry points for construction of ManagedChannel instances, however, this mechanism is outside the influence of the Spring application context.

Spring Cloud Sleuth provides a SpringAwareManagedChannelBuilder that can be customized through the Spring application context and injected by gRPC clients. This builder must be used when creating ManagedChannel instances.
Sleuth creates a TracingManagedChannelBuilderCustomizer which inject Brave’s client interceptor into the SpringAwareManagedChannelBuilder.

15.9.2. Variant 2

Grpc Spring Boot Starter automatically detects the presence of Spring Cloud Sleuth and brave’s instrumentation for gRPC and registers the necessary client and/or server tooling.

15.10. Asynchronous Communication

15.10.1. @Async Annotated methods

In Spring Cloud Sleuth, we instrument async-related components so that the tracing information is passed between threads. You can disable this behavior by setting the value of spring.sleuth.async.enabled to false.

If you annotate your method with @Async, we automatically create a new Span with the following characteristics:

If the method is annotated with @SpanName, the value of the annotation is the Span’s name.

If the method is not annotated with @SpanName, the Span name is the annotated method name.

The span is tagged with the method’s class name and method name.

15.10.2. @Scheduled Annotated Methods

In Spring Cloud Sleuth, we instrument scheduled method execution so that the tracing information is passed between threads. You can disable this behavior by setting the value of spring.sleuth.scheduled.enabled to false.

If you annotate your method with @Scheduled, we automatically create a new span with the following characteristics:

The span name is the annotated method name.

The span is tagged with the method’s class name and method name.

If you want to skip span creation for some @Scheduled annotated classes, you can set the spring.sleuth.scheduled.skipPattern with a regular expression that matches the fully qualified name of the @Scheduled annotated class. If you use spring-cloud-sleuth-stream and spring-cloud-netflix-hystrix-stream together, a span is created for each Hystrix metrics and sent to Zipkin. This behavior may be annoying. That’s why, by default, spring.sleuth.scheduled.skipPattern=org.springframework.cloud.netflix.hystrix.stream.HystrixStreamTask.

15.10.3. Executor, ExecutorService, and ScheduledExecutorService

We provide LazyTraceExecutor, TraceableExecutorService, and TraceableScheduledExecutorService. Those implementations create spans each time a new task is submitted, invoked, or scheduled.

The following example shows how to pass tracing information with TraceableExecutorService when working with CompletableFuture:

CompletableFuture<Long> completableFuture = CompletableFuture.supplyAsync(() -> {
    // perform some logic
    return 1_000_000L;
}, new TraceableExecutorService(beanFactory, executorService,
        // 'calculateTax' explicitly names the span - this param is optional
        "calculateTax"));
Sleuth does not work with parallelStream() out of the box. If you want to have the tracing information propagated through the stream, you have to use the approach with supplyAsync(...), as shown earlier.
If there are beans that implement the Executor interface that you would like to exclude from span creation, you can use the spring.sleuth.async.ignored-beans property where you can provide a list of bean names.

Customization of Executors
Sometimes, you need to set up a custom instance of the AsyncExecutor. The following example shows how to set up such a custom Executor:

@Configuration
@EnableAutoConfiguration
@EnableAsync
// add the infrastructure role to ensure that the bean gets auto-proxied
@Role(BeanDefinition.ROLE_INFRASTRUCTURE)
static class CustomExecutorConfig extends AsyncConfigurerSupport {

    @Autowired
    BeanFactory beanFactory;

    @Override
    public Executor getAsyncExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        // CUSTOMIZE HERE
        executor.setCorePoolSize(7);
        executor.setMaxPoolSize(42);
        executor.setQueueCapacity(11);
        executor.setThreadNamePrefix("MyExecutor-");
        // DON'T FORGET TO INITIALIZE
        executor.initialize();
        return new LazyTraceExecutor(this.beanFactory, executor);
    }

}
To ensure that your configuration gets post processed, remember to add the @Role(BeanDefinition.ROLE_INFRASTRUCTURE) on your @Configuration class
15.11. Messaging

Features from this section can be disabled by setting the spring.sleuth.messaging.enabled property with value equal to false.

15.11.1. Spring Integration and Spring Cloud Stream

Spring Cloud Sleuth integrates with Spring Integration. It creates spans for publish and subscribe events. To disable Spring Integration instrumentation, set spring.sleuth.integration.enabled to false.

You can provide the spring.sleuth.integration.patterns pattern to explicitly provide the names of channels that you want to include for tracing. By default, all channels but hystrixStreamOutput channel are included.

When using the Executor to build a Spring Integration IntegrationFlow, you must use the untraced version of the Executor. Decorating the Spring Integration Executor Channel with TraceableExecutorService causes the spans to be improperly closed.
If you want to customize the way tracing context is read from and written to message headers, it’s enough for you to register beans of types:

Propagation.Setter<MessageHeaderAccessor, String> - for writing headers to the message

Propagation.Getter<MessageHeaderAccessor, String> - for reading headers from the message

15.11.2. Spring RabbitMq

We instrument the RabbitTemplate so that tracing headers get injected into the message.

To block this feature, set spring.sleuth.messaging.rabbit.enabled to false.

15.11.3. Spring Kafka

We instrument the Spring Kafka’s ProducerFactory and ConsumerFactory so that tracing headers get injected into the created Spring Kafka’s Producer and Consumer.

To block this feature, set spring.sleuth.messaging.kafka.enabled to false.

15.11.4. Spring Kafka Streams

We instrument the KafkaStreams KafkaClientSupplier so that tracing headers get injected into the Producer and Consumer`s. A `KafkaStreamsTracing bean allows for further instrumentation through additional TransformerSupplier and ProcessorSupplier methods.

To block this feature, set spring.sleuth.messaging.kafka.streams.enabled to false.

15.11.5. Spring JMS

We instrument the JmsTemplate so that tracing headers get injected into the message. We also support @JmsListener annotated methods on the consumer side.

To block this feature, set spring.sleuth.messaging.jms.enabled to false.

We don’t support baggage propagation for JMS
15.11.6. Spring Cloud AWS Messaging SQS

We instrument @SqsListener which is provided by org.springframework.cloud:spring-cloud-aws-messaging so that tracing headers get extracted from the message and a trace gets put into the context.

To block this feature, set spring.sleuth.messaging.sqs.enabled to false.

15.12. Zuul

We instrument the Zuul Ribbon integration by enriching the Ribbon requests with tracing information. To disable Zuul support, set the spring.sleuth.zuul.enabled property to false.

15.13. Redis

We set tracing property to Lettcue ClientResources instance to enable Brave tracing built in Lettuce . To disable Redis support, set the spring.sleuth.redis.enabled property to false.

15.14. Quartz

We instrument quartz jobs by adding Job/Trigger listeners to the Quartz Scheduler.

To turn off this feature, set the spring.sleuth.quartz.enabled property to false.

15.15. Project Reactor

For projects depending on Project Reactor such as Spring Cloud Gateway, we suggest turning the spring.sleuth.reactor.decorate-on-each option to false. That way an increased performance gain should be observed in comparison to the standard instrumentation mechanism. What this option does is it will wrap decorate onLast operator instead of onEach which will result in creation of far fewer objects. The downside of this is that when Project Reactor will change threads, the trace propagation will continue without issues, however anything relying on the ThreadLocal such as e.g. MDC entries can be buggy.