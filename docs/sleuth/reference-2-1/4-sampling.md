Sampling may be employed to reduce the data collected and reported out of process. When a span is not sampled, it adds no overhead (a noop).

Sampling is an up-front decision, meaning that the decision to report data is made at the first operation in a trace and that decision is propagated downstream.

By default, a global sampler applies a single rate to all traced operations. Tracer.Builder.sampler controls this setting, and it defaults to tracing every request.

4.1. Declarative sampling

Some applications need to sample based on the type or annotations of a java method.

Most users use a framework interceptor to automate this sort of policy. The following example shows how that might work internally:

@Autowired Tracer tracer;

// derives a sample rate from an annotation on a java method
DeclarativeSampler<Traced> sampler = DeclarativeSampler.create(Traced::sampleRate);

@Around("@annotation(traced)")
public Object traceThing(ProceedingJoinPoint pjp, Traced traced) throws Throwable {
  // When there is no trace in progress, this decides using an annotation
  Sampler decideUsingAnnotation = declarativeSampler.toSampler(traced);
  Tracer tracer = tracer.withSampler(decideUsingAnnotation);

  // This code looks the same as if there was no declarative override
  ScopedSpan span = tracer.startScopedSpan(spanName(pjp));
  try {
    return pjp.proceed();
  } catch (RuntimeException | Error e) {
    span.error(e);
    throw e;
  } finally {
    span.finish();
  }
}
4.2. Custom sampling

Depending on what the operation is, you may want to apply different policies. For example, you might not want to trace requests to static resources such as images, or you might want to trace all requests to a new api.

Most users use a framework interceptor to automate this sort of policy. The following example shows how that might work internally:

@Autowired Tracer tracer;
@Autowired Sampler fallback;

Span nextSpan(final Request input) {
  Sampler requestBased = Sampler() {
    @Override public boolean isSampled(long traceId) {
      if (input.url().startsWith("/experimental")) {
        return true;
      } else if (input.url().startsWith("/static")) {
        return false;
      }
      return fallback.isSampled(traceId);
    }
  };
  return tracer.withSampler(requestBased).nextSpan();
}
4.3. Sampling in Spring Cloud Sleuth

By default Spring Cloud Sleuth sets all spans to non-exportable. That means that traces appear in logs but not in any remote store. For testing the default is often enough, and it probably is all you need if you use only the logs (for example, with an ELK aggregator). If you export span data to Zipkin, there is also an Sampler.ALWAYS_SAMPLE setting that exports everything, RateLimitingSampler setting that samples X transactions per second (defaults to 1000) or ProbabilityBasedSampler setting that samples a fixed fraction of spans.

The RateLimitingSampler is the default if you use spring-cloud-sleuth-zipkin. You can configure the rate limit by setting spring.sleuth.sampler.rate.
A sampler can be installed by creating a bean definition, as shown in the following example:

@Bean
public Sampler defaultSampler() {
    return Sampler.ALWAYS_SAMPLE;
}
You can set the HTTP header X-B3-Flags to 1, or, when doing messaging, you can set the spanFlags header to 1. Doing so forces the current span to be exportable regardless of the sampling decision.
In order to use the rate-limited sampler set the spring.sleuth.sampler.rate property to choose an amount of traces to accept on a per-second interval. The minimum number is 0 and the max is 2,147,483,647 (max int).