const sidebar = require('./config/sidebar.js');

const nav = [
  { text: 'Home', link: '/' },
  { text: 'Notes', items: [
    { text: 'Sleuth', link: '/sleuth/' }
  ] },
  { text: 'Sources', items: [
    { text: 'Sleuth', link: 'https://spring.io/projects/spring-cloud-sleuth' }, 
    { text: 'SkyWalking', link: 'https://skywalking.apache.org/zh/' }, 
    { text: 'Zipkin', link: 'https://zipkin.io/' }, 
    { text: 'HTrace', link: 'http://incubator.apache.org/projects/htrace.html' }, 
    { text: 'PinPoint', link: 'https://github.com/naver/pinpoint' }, 
    { text: 'Jaeger', link: 'https://www.jaegertracing.io/' }, 
    { text: 'OpenTracing', link: 'https://github.com/opentracing/opentracing-java' }
  ] }
];

module.exports = {
  title: 'APM Notes',
  description: 'Application Performance Management Notes',
  author: 'zhangfucheng',
  head: [
    [ "link", {rel: "icon", href: "/logo-s.png"}], 
    [ "meta", { "name": "viewport", "content": "width=device-width,initial-scale=1,user-scalable=no" } ]
  ],
  theme: 'reco',
  themeConfig: {
    // 关闭主题颜色选择器
    themePicker: false,
    // 关闭腾讯失踪人口的404页面 
    noFoundPageByTencent: false, 
     // 博客配置
    blogConfig: {
      /* category: {
        location: 2,     // 在导航栏菜单中所占的位置，默认2
        text: 'Category' // 默认文案 “分类”
      },
      tag: {
        location: 3,     // 在导航栏菜单中所占的位置，默认3
        text: 'Tag'      // 默认文案 “标签”
      }*/
    }, 
    nav,
    sidebar, 
    lastUpdated: 'Last Updated'
  }
}