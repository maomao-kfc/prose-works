import { onRequest as __api_count__key__js_onRequest } from "D:\\wode\\prose-works\\functions\\api\\count\\[key].js"
import { onRequest as __api_visit_log_js_onRequest } from "D:\\wode\\prose-works\\functions\\api\\visit-log.js"

export const routes = [
    {
      routePath: "/api/count/:key",
      mountPath: "/api/count",
      method: "",
      middlewares: [],
      modules: [__api_count__key__js_onRequest],
    },
  {
      routePath: "/api/visit-log",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_visit_log_js_onRequest],
    },
  ]