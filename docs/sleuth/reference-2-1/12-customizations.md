12.1. Customizers

With Brave 5.7 you have various options of providing customizers for your project. Brave ships with

TracingCustomizer - allows configuration plugins to collaborate on building an instance of Tracing.

CurrentTraceContextCustomizer - allows configuration plugins to collaborate on building an instance of CurrentTraceContext.

ExtraFieldCustomizer - allows configuration plugins to collaborate on building an instance of ExtraFieldPropagation.Factory.

Sleuth will search for beans of those types and automatically apply customizations.

12.2. HTTP

If a customization of client / server parsing of the HTTP related spans is required, just register a bean of type brave.http.HttpClientParser or brave.http.HttpServerParser. If client /server sampling is required, just register a bean of type brave.sampler.SamplerFunction<HttpRequest> and name the bean sleuthHttpClientSampler for client sampler and sleuthHttpServerSampler for server sampler.

For your convenience the @HttpClientSampler and @HttpServerSampler annotations can be used to inject the proper beans or to reference the bean names via their static String NAME fields.

Check out Brave’s code to see an example of how to make a path-based sampler github.com/openzipkin/brave/tree/master/instrumentation/http#sampling-policy

If you want to completely rewrite the HttpTracing bean you can use the SkipPatternProvider interface to retrieve the URL Pattern for spans that should be not sampled. Below you can see an example of usage of SkipPatternProvider inside a server side, Sampler<HttpRequest>.

@Configuration
class Config {
  @Bean(name = HttpServerSampler.NAME)
  SamplerFunction<HttpRequest> myHttpSampler(SkipPatternProvider provider) {
      Pattern pattern = provider.skipPattern();
      return request -> {
          String url = request.path();
          boolean shouldSkip = pattern.matcher(url).matches();
          if (shouldSkip) {
              return false;
          }
          return null;
      };
  }
}
12.3. TracingFilter

You can also modify the behavior of the TracingFilter, which is the component that is responsible for processing the input HTTP request and adding tags basing on the HTTP response. You can customize the tags or modify the response headers by registering your own instance of the TracingFilter bean.

In the following example, we register the TracingFilter bean, add the ZIPKIN-TRACE-ID response header containing the current Span’s trace id, and add a tag with key custom and a value tag to the span.

@Component
@Order(TraceWebServletAutoConfiguration.TRACING_FILTER_ORDER + 1)
class MyFilter extends GenericFilterBean {

    private final Tracer tracer;

    MyFilter(Tracer tracer) {
        this.tracer = tracer;
    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response,
            FilterChain chain) throws IOException, ServletException {
        Span currentSpan = this.tracer.currentSpan();
        if (currentSpan == null) {
            chain.doFilter(request, response);
            return;
        }
        // for readability we're returning trace id in a hex form
        ((HttpServletResponse) response).addHeader("ZIPKIN-TRACE-ID",
                currentSpan.context().traceIdString());
        // we can also add some custom tags
        currentSpan.tag("custom", "tag");
        chain.doFilter(request, response);
    }

}
12.4. Messaging

Sleuth automatically configures the MessagingTracing bean which serves as a foundation for Messaging instrumentation such as Kafka or JMS.

If a customization of producer / consumer sampling of messaging traces is required, just register a bean of type brave.sampler.SamplerFunction<MessagingRequest> and name the bean sleuthProducerSampler for producer sampler and sleuthConsumerSampler for consumer sampler.

For your convenience the @ProducerSampler and @ConsumerSampler annotations can be used to inject the proper beans or to reference the bean names via their static String NAME fields.

Ex. Here’s a sampler that traces 100 consumer requests per second, except for the "alerts" channel. Other requests will use a global rate provided by the Tracing component.

@Configuration
class Config {
}
For more, see github.com/openzipkin/brave/tree/master/instrumentation/messaging#sampling-policy

12.5. RPC

Sleuth automatically configures the RpcTracing bean which serves as a foundation for RPC instrumentation such as gRPC or Dubbo.

If a customization of client / server sampling of the RPC traces is required, just register a bean of type brave.sampler.SamplerFunction<RpcRequest> and name the bean sleuthRpcClientSampler for client sampler and sleuthRpcServerSampler for server sampler.

For your convenience the @RpcClientSampler and @RpcServerSampler annotations can be used to inject the proper beans or to reference the bean names via their static String NAME fields.

Ex. Here’s a sampler that traces 100 "GetUserToken" server requests per second. This doesn’t start new traces for requests to the health check service. Other requests will use the global sampling configuration.

@Configuration
class Config {
  @Bean(name = RpcServerSampler.NAME)
  SamplerFunction<RpcRequest> myRpcSampler() {
      Matcher<RpcRequest> userAuth = and(serviceEquals("users.UserService"),
              methodEquals("GetUserToken"));
      return RpcRuleSampler.newBuilder()
              .putRule(serviceEquals("grpc.health.v1.Health"), Sampler.NEVER_SAMPLE)
              .putRule(userAuth, RateLimitingSampler.create(100)).build();
  }
}
For more, see github.com/openzipkin/brave/tree/master/instrumentation/rpc#sampling-policy

12.6. Custom service name

By default, Sleuth assumes that, when you send a span to Zipkin, you want the span’s service name to be equal to the value of the spring.application.name property. That is not always the case, though. There are situations in which you want to explicitly provide a different service name for all spans coming from your application. To achieve that, you can pass the following property to your application to override that value (the example is for a service named myService):

spring.zipkin.service.name: myService
12.7. Customization of Reported Spans

Before reporting spans (for example, to Zipkin) you may want to modify that span in some way. You can do so by using the FinishedSpanHandler interface.

In Sleuth, we generate spans with a fixed name. Some users want to modify the name depending on values of tags. You can implement the FinishedSpanHandler interface to alter that name.

The following example shows how to register two beans that implement FinishedSpanHandler:

@Bean
FinishedSpanHandler handlerOne() {
    return new FinishedSpanHandler() {
        @Override
        public boolean handle(TraceContext traceContext, MutableSpan span) {
            span.name("foo");
            return true; // keep this span
        }
    };
}

@Bean
FinishedSpanHandler handlerTwo() {
    return new FinishedSpanHandler() {
        @Override
        public boolean handle(TraceContext traceContext, MutableSpan span) {
            span.name(span.name() + " bar");
            return true; // keep this span
        }
    };
}
The preceding example results in changing the name of the reported span to foo bar, just before it gets reported (for example, to Zipkin).

12.8. Host Locator

This section is about defining host from service discovery. It is NOT about finding Zipkin through service discovery.
To define the host that corresponds to a particular span, we need to resolve the host name and port. The default approach is to take these values from server properties. If those are not set, we try to retrieve the host name from the network interfaces.

If you have the discovery client enabled and prefer to retrieve the host address from the registered instance in a service registry, you have to set the spring.zipkin.locator.discovery.enabled property (it is applicable for both HTTP-based and Stream-based span reporting), as follows:

spring.zipkin.locator.discovery.enabled: true