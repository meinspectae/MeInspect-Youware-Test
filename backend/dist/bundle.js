var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// node_modules/hono/dist/compose.js
var compose = (middleware, onError, onNotFound) => {
  return (context, next) => {
    let index2 = -1;
    return dispatch(0);
    async function dispatch(i) {
      if (i <= index2) {
        throw new Error("next() called multiple times");
      }
      index2 = i;
      let res;
      let isError = false;
      let handler;
      if (middleware[i]) {
        handler = middleware[i][0][0];
        context.req.routeIndex = i;
      } else {
        handler = i === middleware.length && next || void 0;
      }
      if (handler) {
        try {
          res = await handler(context, () => dispatch(i + 1));
        } catch (err) {
          if (err instanceof Error && onError) {
            context.error = err;
            res = await onError(err, context);
            isError = true;
          } else {
            throw err;
          }
        }
      } else {
        if (context.finalized === false && onNotFound) {
          res = await onNotFound(context);
        }
      }
      if (res && (context.finalized === false || isError)) {
        context.res = res;
      }
      return context;
    }
  };
};

// node_modules/hono/dist/request/constants.js
var GET_MATCH_RESULT = /* @__PURE__ */ Symbol();

// node_modules/hono/dist/utils/body.js
var parseBody = async (request, options = /* @__PURE__ */ Object.create(null)) => {
  const { all = false, dot = false } = options;
  const headers = request instanceof HonoRequest ? request.raw.headers : request.headers;
  const contentType = headers.get("Content-Type");
  if (contentType?.startsWith("multipart/form-data") || contentType?.startsWith("application/x-www-form-urlencoded")) {
    return parseFormData(request, { all, dot });
  }
  return {};
};
async function parseFormData(request, options) {
  const formData = await request.formData();
  if (formData) {
    return convertFormDataToBodyData(formData, options);
  }
  return {};
}
function convertFormDataToBodyData(formData, options) {
  const form = /* @__PURE__ */ Object.create(null);
  formData.forEach((value, key) => {
    const shouldParseAllValues = options.all || key.endsWith("[]");
    if (!shouldParseAllValues) {
      form[key] = value;
    } else {
      handleParsingAllValues(form, key, value);
    }
  });
  if (options.dot) {
    Object.entries(form).forEach(([key, value]) => {
      const shouldParseDotValues = key.includes(".");
      if (shouldParseDotValues) {
        handleParsingNestedValues(form, key, value);
        delete form[key];
      }
    });
  }
  return form;
}
var handleParsingAllValues = (form, key, value) => {
  if (form[key] !== void 0) {
    if (Array.isArray(form[key])) {
      ;
      form[key].push(value);
    } else {
      form[key] = [form[key], value];
    }
  } else {
    if (!key.endsWith("[]")) {
      form[key] = value;
    } else {
      form[key] = [value];
    }
  }
};
var handleParsingNestedValues = (form, key, value) => {
  if (/(?:^|\.)__proto__\./.test(key)) {
    return;
  }
  let nestedForm = form;
  const keys = key.split(".");
  keys.forEach((key2, index2) => {
    if (index2 === keys.length - 1) {
      nestedForm[key2] = value;
    } else {
      if (!nestedForm[key2] || typeof nestedForm[key2] !== "object" || Array.isArray(nestedForm[key2]) || nestedForm[key2] instanceof File) {
        nestedForm[key2] = /* @__PURE__ */ Object.create(null);
      }
      nestedForm = nestedForm[key2];
    }
  });
};

// node_modules/hono/dist/utils/url.js
var splitPath = (path) => {
  const paths = path.split("/");
  if (paths[0] === "") {
    paths.shift();
  }
  return paths;
};
var splitRoutingPath = (routePath) => {
  const { groups, path } = extractGroupsFromPath(routePath);
  const paths = splitPath(path);
  return replaceGroupMarks(paths, groups);
};
var extractGroupsFromPath = (path) => {
  const groups = [];
  path = path.replace(/\{[^}]+\}/g, (match2, index2) => {
    const mark = `@${index2}`;
    groups.push([mark, match2]);
    return mark;
  });
  return { groups, path };
};
var replaceGroupMarks = (paths, groups) => {
  for (let i = groups.length - 1; i >= 0; i--) {
    const [mark] = groups[i];
    for (let j = paths.length - 1; j >= 0; j--) {
      if (paths[j].includes(mark)) {
        paths[j] = paths[j].replace(mark, groups[i][1]);
        break;
      }
    }
  }
  return paths;
};
var patternCache = {};
var getPattern = (label, next) => {
  if (label === "*") {
    return "*";
  }
  const match2 = label.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
  if (match2) {
    const cacheKey = `${label}#${next}`;
    if (!patternCache[cacheKey]) {
      if (match2[2]) {
        patternCache[cacheKey] = next && next[0] !== ":" && next[0] !== "*" ? [cacheKey, match2[1], new RegExp(`^${match2[2]}(?=/${next})`)] : [label, match2[1], new RegExp(`^${match2[2]}$`)];
      } else {
        patternCache[cacheKey] = [label, match2[1], true];
      }
    }
    return patternCache[cacheKey];
  }
  return null;
};
var tryDecode = (str, decoder) => {
  try {
    return decoder(str);
  } catch {
    return str.replace(/(?:%[0-9A-Fa-f]{2})+/g, (match2) => {
      try {
        return decoder(match2);
      } catch {
        return match2;
      }
    });
  }
};
var tryDecodeURI = (str) => tryDecode(str, decodeURI);
var getPath = (request) => {
  const url = request.url;
  const start = url.indexOf("/", url.indexOf(":") + 4);
  let i = start;
  for (; i < url.length; i++) {
    const charCode = url.charCodeAt(i);
    if (charCode === 37) {
      const queryIndex = url.indexOf("?", i);
      const hashIndex = url.indexOf("#", i);
      const end = queryIndex === -1 ? hashIndex === -1 ? void 0 : hashIndex : hashIndex === -1 ? queryIndex : Math.min(queryIndex, hashIndex);
      const path = url.slice(start, end);
      return tryDecodeURI(path.includes("%25") ? path.replace(/%25/g, "%2525") : path);
    } else if (charCode === 63 || charCode === 35) {
      break;
    }
  }
  return url.slice(start, i);
};
var getPathNoStrict = (request) => {
  const result = getPath(request);
  return result.length > 1 && result.at(-1) === "/" ? result.slice(0, -1) : result;
};
var mergePath = (base, sub, ...rest) => {
  if (rest.length) {
    sub = mergePath(sub, ...rest);
  }
  return `${base?.[0] === "/" ? "" : "/"}${base}${sub === "/" ? "" : `${base?.at(-1) === "/" ? "" : "/"}${sub?.[0] === "/" ? sub.slice(1) : sub}`}`;
};
var checkOptionalParameter = (path) => {
  if (path.charCodeAt(path.length - 1) !== 63 || !path.includes(":")) {
    return null;
  }
  const segments = path.split("/");
  const results = [];
  let basePath = "";
  segments.forEach((segment) => {
    if (segment !== "" && !/\:/.test(segment)) {
      basePath += "/" + segment;
    } else if (/\:/.test(segment)) {
      if (/\?/.test(segment)) {
        if (results.length === 0 && basePath === "") {
          results.push("/");
        } else {
          results.push(basePath);
        }
        const optionalSegment = segment.replace("?", "");
        basePath += "/" + optionalSegment;
        results.push(basePath);
      } else {
        basePath += "/" + segment;
      }
    }
  });
  return results.filter((v, i, a) => a.indexOf(v) === i);
};
var _decodeURI = (value) => {
  if (!/[%+]/.test(value)) {
    return value;
  }
  if (value.indexOf("+") !== -1) {
    value = value.replace(/\+/g, " ");
  }
  return value.indexOf("%") !== -1 ? tryDecode(value, decodeURIComponent_) : value;
};
var _getQueryParam = (url, key, multiple) => {
  let encoded;
  if (!multiple && key && !/[%+]/.test(key)) {
    let keyIndex2 = url.indexOf("?", 8);
    if (keyIndex2 === -1) {
      return void 0;
    }
    if (!url.startsWith(key, keyIndex2 + 1)) {
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    while (keyIndex2 !== -1) {
      const trailingKeyCode = url.charCodeAt(keyIndex2 + key.length + 1);
      if (trailingKeyCode === 61) {
        const valueIndex = keyIndex2 + key.length + 2;
        const endIndex = url.indexOf("&", valueIndex);
        return _decodeURI(url.slice(valueIndex, endIndex === -1 ? void 0 : endIndex));
      } else if (trailingKeyCode == 38 || isNaN(trailingKeyCode)) {
        return "";
      }
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    encoded = /[%+]/.test(url);
    if (!encoded) {
      return void 0;
    }
  }
  const results = {};
  encoded ??= /[%+]/.test(url);
  let keyIndex = url.indexOf("?", 8);
  while (keyIndex !== -1) {
    const nextKeyIndex = url.indexOf("&", keyIndex + 1);
    let valueIndex = url.indexOf("=", keyIndex);
    if (valueIndex > nextKeyIndex && nextKeyIndex !== -1) {
      valueIndex = -1;
    }
    let name = url.slice(
      keyIndex + 1,
      valueIndex === -1 ? nextKeyIndex === -1 ? void 0 : nextKeyIndex : valueIndex
    );
    if (encoded) {
      name = _decodeURI(name);
    }
    keyIndex = nextKeyIndex;
    if (name === "") {
      continue;
    }
    let value;
    if (valueIndex === -1) {
      value = "";
    } else {
      value = url.slice(valueIndex + 1, nextKeyIndex === -1 ? void 0 : nextKeyIndex);
      if (encoded) {
        value = _decodeURI(value);
      }
    }
    if (multiple) {
      if (!(results[name] && Array.isArray(results[name]))) {
        results[name] = [];
      }
      ;
      results[name].push(value);
    } else {
      results[name] ??= value;
    }
  }
  return key ? results[key] : results;
};
var getQueryParam = _getQueryParam;
var getQueryParams = (url, key) => {
  return _getQueryParam(url, key, true);
};
var decodeURIComponent_ = decodeURIComponent;

// node_modules/hono/dist/request.js
var tryDecodeURIComponent = (str) => tryDecode(str, decodeURIComponent_);
var HonoRequest = class {
  /**
   * `.raw` can get the raw Request object.
   *
   * @see {@link https://hono.dev/docs/api/request#raw}
   *
   * @example
   * ```ts
   * // For Cloudflare Workers
   * app.post('/', async (c) => {
   *   const metadata = c.req.raw.cf?.hostMetadata?
   *   ...
   * })
   * ```
   */
  raw;
  #validatedData;
  // Short name of validatedData
  #matchResult;
  routeIndex = 0;
  /**
   * `.path` can get the pathname of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#path}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const pathname = c.req.path // `/about/me`
   * })
   * ```
   */
  path;
  bodyCache = {};
  constructor(request, path = "/", matchResult = [[]]) {
    this.raw = request;
    this.path = path;
    this.#matchResult = matchResult;
    this.#validatedData = {};
  }
  param(key) {
    return key ? this.#getDecodedParam(key) : this.#getAllDecodedParams();
  }
  #getDecodedParam(key) {
    const paramKey = this.#matchResult[0][this.routeIndex][1][key];
    const param = this.#getParamValue(paramKey);
    return param && /\%/.test(param) ? tryDecodeURIComponent(param) : param;
  }
  #getAllDecodedParams() {
    const decoded = {};
    const keys = Object.keys(this.#matchResult[0][this.routeIndex][1]);
    for (const key of keys) {
      const value = this.#getParamValue(this.#matchResult[0][this.routeIndex][1][key]);
      if (value !== void 0) {
        decoded[key] = /\%/.test(value) ? tryDecodeURIComponent(value) : value;
      }
    }
    return decoded;
  }
  #getParamValue(paramKey) {
    return this.#matchResult[1] ? this.#matchResult[1][paramKey] : paramKey;
  }
  query(key) {
    return getQueryParam(this.url, key);
  }
  queries(key) {
    return getQueryParams(this.url, key);
  }
  header(name) {
    if (name) {
      return this.raw.headers.get(name) ?? void 0;
    }
    const headerData = {};
    this.raw.headers.forEach((value, key) => {
      headerData[key] = value;
    });
    return headerData;
  }
  async parseBody(options) {
    return parseBody(this, options);
  }
  #cachedBody = (key) => {
    const { bodyCache, raw: raw2 } = this;
    const cachedBody = bodyCache[key];
    if (cachedBody) {
      return cachedBody;
    }
    const anyCachedKey = Object.keys(bodyCache)[0];
    if (anyCachedKey) {
      return bodyCache[anyCachedKey].then((body) => {
        if (anyCachedKey === "json") {
          body = JSON.stringify(body);
        }
        return new Response(body)[key]();
      });
    }
    return bodyCache[key] = raw2[key]();
  };
  /**
   * `.json()` can parse Request body of type `application/json`
   *
   * @see {@link https://hono.dev/docs/api/request#json}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.json()
   * })
   * ```
   */
  json() {
    return this.#cachedBody("text").then((text2) => JSON.parse(text2));
  }
  /**
   * `.text()` can parse Request body of type `text/plain`
   *
   * @see {@link https://hono.dev/docs/api/request#text}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.text()
   * })
   * ```
   */
  text() {
    return this.#cachedBody("text");
  }
  /**
   * `.arrayBuffer()` parse Request body as an `ArrayBuffer`
   *
   * @see {@link https://hono.dev/docs/api/request#arraybuffer}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.arrayBuffer()
   * })
   * ```
   */
  arrayBuffer() {
    return this.#cachedBody("arrayBuffer");
  }
  /**
   * `.bytes()` parses the request body as a `Uint8Array`.
   *
   * @see {@link https://hono.dev/docs/api/request#bytes}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.bytes()
   * })
   * ```
   */
  bytes() {
    return this.#cachedBody("arrayBuffer").then((buffer) => new Uint8Array(buffer));
  }
  /**
   * Parses the request body as a `Blob`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.blob();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#blob
   */
  blob() {
    return this.#cachedBody("blob");
  }
  /**
   * Parses the request body as `FormData`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.formData();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#formdata
   */
  formData() {
    return this.#cachedBody("formData");
  }
  /**
   * Adds validated data to the request.
   *
   * @param target - The target of the validation.
   * @param data - The validated data to add.
   */
  addValidatedData(target, data) {
    this.#validatedData[target] = data;
  }
  valid(target) {
    return this.#validatedData[target];
  }
  /**
   * `.url()` can get the request url strings.
   *
   * @see {@link https://hono.dev/docs/api/request#url}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const url = c.req.url // `http://localhost:8787/about/me`
   *   ...
   * })
   * ```
   */
  get url() {
    return this.raw.url;
  }
  /**
   * `.method()` can get the method name of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#method}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const method = c.req.method // `GET`
   * })
   * ```
   */
  get method() {
    return this.raw.method;
  }
  get [GET_MATCH_RESULT]() {
    return this.#matchResult;
  }
  /**
   * `.matchedRoutes()` can return a matched route in the handler
   *
   * @deprecated
   *
   * Use matchedRoutes helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#matchedroutes}
   *
   * @example
   * ```ts
   * app.use('*', async function logger(c, next) {
   *   await next()
   *   c.req.matchedRoutes.forEach(({ handler, method, path }, i) => {
   *     const name = handler.name || (handler.length < 2 ? '[handler]' : '[middleware]')
   *     console.log(
   *       method,
   *       ' ',
   *       path,
   *       ' '.repeat(Math.max(10 - path.length, 0)),
   *       name,
   *       i === c.req.routeIndex ? '<- respond from here' : ''
   *     )
   *   })
   * })
   * ```
   */
  get matchedRoutes() {
    return this.#matchResult[0].map(([[, route]]) => route);
  }
  /**
   * `routePath()` can retrieve the path registered within the handler
   *
   * @deprecated
   *
   * Use routePath helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#routepath}
   *
   * @example
   * ```ts
   * app.get('/posts/:id', (c) => {
   *   return c.json({ path: c.req.routePath })
   * })
   * ```
   */
  get routePath() {
    return this.#matchResult[0].map(([[, route]]) => route)[this.routeIndex].path;
  }
};

// node_modules/hono/dist/utils/html.js
var HtmlEscapedCallbackPhase = {
  Stringify: 1,
  BeforeStream: 2,
  Stream: 3
};
var raw = (value, callbacks) => {
  const escapedString = new String(value);
  escapedString.isEscaped = true;
  escapedString.callbacks = callbacks;
  return escapedString;
};
var resolveCallback = async (str, phase, preserveCallbacks, context, buffer) => {
  if (typeof str === "object" && !(str instanceof String)) {
    if (!(str instanceof Promise)) {
      str = str.toString();
    }
    if (str instanceof Promise) {
      str = await str;
    }
  }
  const callbacks = str.callbacks;
  if (!callbacks?.length) {
    return Promise.resolve(str);
  }
  if (buffer) {
    buffer[0] += str;
  } else {
    buffer = [str];
  }
  const resStr = Promise.all(callbacks.map((c) => c({ phase, buffer, context }))).then(
    (res) => Promise.all(
      res.filter(Boolean).map((str2) => resolveCallback(str2, phase, false, context, buffer))
    ).then(() => buffer[0])
  );
  if (preserveCallbacks) {
    return raw(await resStr, callbacks);
  } else {
    return resStr;
  }
};

// node_modules/hono/dist/context.js
var TEXT_PLAIN = "text/plain; charset=UTF-8";
var setDefaultContentType = (contentType, headers) => {
  return {
    "Content-Type": contentType,
    ...headers
  };
};
var createResponseInstance = (body, init) => new Response(body, init);
var Context = class {
  #rawRequest;
  #req;
  /**
   * `.env` can get bindings (environment variables, secrets, KV namespaces, D1 database, R2 bucket etc.) in Cloudflare Workers.
   *
   * @see {@link https://hono.dev/docs/api/context#env}
   *
   * @example
   * ```ts
   * // Environment object for Cloudflare Workers
   * app.get('*', async c => {
   *   const counter = c.env.COUNTER
   * })
   * ```
   */
  env = {};
  #var;
  finalized = false;
  /**
   * `.error` can get the error object from the middleware if the Handler throws an error.
   *
   * @see {@link https://hono.dev/docs/api/context#error}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   await next()
   *   if (c.error) {
   *     // do something...
   *   }
   * })
   * ```
   */
  error;
  #status;
  #executionCtx;
  #res;
  #layout;
  #renderer;
  #notFoundHandler;
  #preparedHeaders;
  #matchResult;
  #path;
  /**
   * Creates an instance of the Context class.
   *
   * @param req - The Request object.
   * @param options - Optional configuration options for the context.
   */
  constructor(req, options) {
    this.#rawRequest = req;
    if (options) {
      this.#executionCtx = options.executionCtx;
      this.env = options.env;
      this.#notFoundHandler = options.notFoundHandler;
      this.#path = options.path;
      this.#matchResult = options.matchResult;
    }
  }
  /**
   * `.req` is the instance of {@link HonoRequest}.
   */
  get req() {
    this.#req ??= new HonoRequest(this.#rawRequest, this.#path, this.#matchResult);
    return this.#req;
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#event}
   * The FetchEvent associated with the current request.
   *
   * @throws Will throw an error if the context does not have a FetchEvent.
   */
  get event() {
    if (this.#executionCtx && "respondWith" in this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no FetchEvent");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#executionctx}
   * The ExecutionContext associated with the current request.
   *
   * @throws Will throw an error if the context does not have an ExecutionContext.
   */
  get executionCtx() {
    if (this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no ExecutionContext");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#res}
   * The Response object for the current request.
   */
  get res() {
    return this.#res ||= createResponseInstance(null, {
      headers: this.#preparedHeaders ??= new Headers()
    });
  }
  /**
   * Sets the Response object for the current request.
   *
   * @param _res - The Response object to set.
   */
  set res(_res) {
    if (this.#res && _res) {
      _res = createResponseInstance(_res.body, _res);
      for (const [k, v] of this.#res.headers.entries()) {
        if (k === "content-type") {
          continue;
        }
        if (k === "set-cookie") {
          const cookies = this.#res.headers.getSetCookie();
          _res.headers.delete("set-cookie");
          for (const cookie of cookies) {
            _res.headers.append("set-cookie", cookie);
          }
        } else {
          _res.headers.set(k, v);
        }
      }
    }
    this.#res = _res;
    this.finalized = true;
  }
  /**
   * `.render()` can create a response within a layout.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   return c.render('Hello!')
   * })
   * ```
   */
  render = (...args) => {
    this.#renderer ??= (content) => this.html(content);
    return this.#renderer(...args);
  };
  /**
   * Sets the layout for the response.
   *
   * @param layout - The layout to set.
   * @returns The layout function.
   */
  setLayout = (layout) => this.#layout = layout;
  /**
   * Gets the current layout for the response.
   *
   * @returns The current layout function.
   */
  getLayout = () => this.#layout;
  /**
   * `.setRenderer()` can set the layout in the custom middleware.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```tsx
   * app.use('*', async (c, next) => {
   *   c.setRenderer((content) => {
   *     return c.html(
   *       <html>
   *         <body>
   *           <p>{content}</p>
   *         </body>
   *       </html>
   *     )
   *   })
   *   await next()
   * })
   * ```
   */
  setRenderer = (renderer) => {
    this.#renderer = renderer;
  };
  /**
   * `.header()` can set headers.
   *
   * @see {@link https://hono.dev/docs/api/context#header}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  header = (name, value, options) => {
    if (this.finalized) {
      this.#res = createResponseInstance(this.#res.body, this.#res);
    }
    const headers = this.#res ? this.#res.headers : this.#preparedHeaders ??= new Headers();
    if (value === void 0) {
      headers.delete(name);
    } else if (options?.append) {
      headers.append(name, value);
    } else {
      headers.set(name, value);
    }
  };
  status = (status) => {
    this.#status = status;
  };
  /**
   * `.set()` can set the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   c.set('message', 'Hono is hot!!')
   *   await next()
   * })
   * ```
   */
  set = (key, value) => {
    this.#var ??= /* @__PURE__ */ new Map();
    this.#var.set(key, value);
  };
  /**
   * `.get()` can use the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   const message = c.get('message')
   *   return c.text(`The message is "${message}"`)
   * })
   * ```
   */
  get = (key) => {
    return this.#var ? this.#var.get(key) : void 0;
  };
  /**
   * `.var` can access the value of a variable.
   *
   * @see {@link https://hono.dev/docs/api/context#var}
   *
   * @example
   * ```ts
   * const result = c.var.client.oneMethod()
   * ```
   */
  // c.var.propName is a read-only
  get var() {
    if (!this.#var) {
      return {};
    }
    return Object.fromEntries(this.#var);
  }
  #newResponse(data, arg, headers) {
    const responseHeaders = this.#res ? new Headers(this.#res.headers) : this.#preparedHeaders ?? new Headers();
    if (typeof arg === "object" && "headers" in arg) {
      const argHeaders = arg.headers instanceof Headers ? arg.headers : new Headers(arg.headers);
      for (const [key, value] of argHeaders) {
        if (key.toLowerCase() === "set-cookie") {
          responseHeaders.append(key, value);
        } else {
          responseHeaders.set(key, value);
        }
      }
    }
    if (headers) {
      for (const [k, v] of Object.entries(headers)) {
        if (typeof v === "string") {
          responseHeaders.set(k, v);
        } else {
          responseHeaders.delete(k);
          for (const v2 of v) {
            responseHeaders.append(k, v2);
          }
        }
      }
    }
    const status = typeof arg === "number" ? arg : arg?.status ?? this.#status;
    return createResponseInstance(data, { status, headers: responseHeaders });
  }
  newResponse = (...args) => this.#newResponse(...args);
  /**
   * `.body()` can return the HTTP response.
   * You can set headers with `.header()` and set HTTP status code with `.status`.
   * This can also be set in `.text()`, `.json()` and so on.
   *
   * @see {@link https://hono.dev/docs/api/context#body}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *   // Set HTTP status code
   *   c.status(201)
   *
   *   // Return the response body
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  body = (data, arg, headers) => this.#newResponse(data, arg, headers);
  /**
   * `.text()` can render text as `Content-Type:text/plain`.
   *
   * @see {@link https://hono.dev/docs/api/context#text}
   *
   * @example
   * ```ts
   * app.get('/say', (c) => {
   *   return c.text('Hello!')
   * })
   * ```
   */
  text = (text2, arg, headers) => {
    return !this.#preparedHeaders && !this.#status && !arg && !headers && !this.finalized ? new Response(text2) : this.#newResponse(
      text2,
      arg,
      setDefaultContentType(TEXT_PLAIN, headers)
    );
  };
  /**
   * `.json()` can render JSON as `Content-Type:application/json`.
   *
   * @see {@link https://hono.dev/docs/api/context#json}
   *
   * @example
   * ```ts
   * app.get('/api', (c) => {
   *   return c.json({ message: 'Hello!' })
   * })
   * ```
   */
  json = (object, arg, headers) => {
    return this.#newResponse(
      JSON.stringify(object),
      arg,
      setDefaultContentType("application/json", headers)
    );
  };
  html = (html, arg, headers) => {
    const res = (html2) => this.#newResponse(html2, arg, setDefaultContentType("text/html; charset=UTF-8", headers));
    return typeof html === "object" ? resolveCallback(html, HtmlEscapedCallbackPhase.Stringify, false, {}).then(res) : res(html);
  };
  /**
   * `.redirect()` can Redirect, default status code is 302.
   *
   * @see {@link https://hono.dev/docs/api/context#redirect}
   *
   * @example
   * ```ts
   * app.get('/redirect', (c) => {
   *   return c.redirect('/')
   * })
   * app.get('/redirect-permanently', (c) => {
   *   return c.redirect('/', 301)
   * })
   * ```
   */
  redirect = (location, status) => {
    const locationString = String(location);
    this.header(
      "Location",
      // Multibyes should be encoded
      // eslint-disable-next-line no-control-regex
      !/[^\x00-\xFF]/.test(locationString) ? locationString : encodeURI(locationString)
    );
    return this.newResponse(null, status ?? 302);
  };
  /**
   * `.notFound()` can return the Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/context#notfound}
   *
   * @example
   * ```ts
   * app.get('/notfound', (c) => {
   *   return c.notFound()
   * })
   * ```
   */
  notFound = () => {
    this.#notFoundHandler ??= () => createResponseInstance();
    return this.#notFoundHandler(this);
  };
};

// node_modules/hono/dist/router.js
var METHOD_NAME_ALL = "ALL";
var METHOD_NAME_ALL_LOWERCASE = "all";
var METHODS = ["get", "post", "put", "delete", "options", "patch"];
var MESSAGE_MATCHER_IS_ALREADY_BUILT = "Can not add a route since the matcher is already built.";
var UnsupportedPathError = class extends Error {
};

// node_modules/hono/dist/utils/constants.js
var COMPOSED_HANDLER = "__COMPOSED_HANDLER";

// node_modules/hono/dist/hono-base.js
var notFoundHandler = (c) => {
  return c.text("404 Not Found", 404);
};
var errorHandler = (err, c) => {
  if ("getResponse" in err) {
    const res = err.getResponse();
    return c.newResponse(res.body, res);
  }
  console.error(err);
  return c.text("Internal Server Error", 500);
};
var Hono = class _Hono {
  get;
  post;
  put;
  delete;
  options;
  patch;
  all;
  on;
  use;
  /*
    This class is like an abstract class and does not have a router.
    To use it, inherit the class and implement router in the constructor.
  */
  router;
  getPath;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  _basePath = "/";
  #path = "/";
  routes = [];
  constructor(options = {}) {
    const allMethods = [...METHODS, METHOD_NAME_ALL_LOWERCASE];
    allMethods.forEach((method) => {
      this[method] = (args1, ...args) => {
        if (typeof args1 === "string") {
          this.#path = args1;
        } else {
          this.#addRoute(method, this.#path, args1);
        }
        args.forEach((handler) => {
          this.#addRoute(method, this.#path, handler);
        });
        return this;
      };
    });
    this.on = (method, path, ...handlers) => {
      for (const p of [path].flat()) {
        this.#path = p;
        for (const m of [method].flat()) {
          handlers.map((handler) => {
            this.#addRoute(m.toUpperCase(), this.#path, handler);
          });
        }
      }
      return this;
    };
    this.use = (arg1, ...handlers) => {
      if (typeof arg1 === "string") {
        this.#path = arg1;
      } else {
        this.#path = "*";
        handlers.unshift(arg1);
      }
      handlers.forEach((handler) => {
        this.#addRoute(METHOD_NAME_ALL, this.#path, handler);
      });
      return this;
    };
    const { strict, ...optionsWithoutStrict } = options;
    Object.assign(this, optionsWithoutStrict);
    this.getPath = strict ?? true ? options.getPath ?? getPath : getPathNoStrict;
  }
  #clone() {
    const clone = new _Hono({
      router: this.router,
      getPath: this.getPath
    });
    clone.errorHandler = this.errorHandler;
    clone.#notFoundHandler = this.#notFoundHandler;
    clone.routes = this.routes;
    return clone;
  }
  #notFoundHandler = notFoundHandler;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  errorHandler = errorHandler;
  /**
   * `.route()` allows grouping other Hono instance in routes.
   *
   * @see {@link https://hono.dev/docs/api/routing#grouping}
   *
   * @param {string} path - base Path
   * @param {Hono} app - other Hono instance
   * @returns {Hono} routed Hono instance
   *
   * @example
   * ```ts
   * const app = new Hono()
   * const app2 = new Hono()
   *
   * app2.get("/user", (c) => c.text("user"))
   * app.route("/api", app2) // GET /api/user
   * ```
   */
  route(path, app) {
    const subApp = this.basePath(path);
    app.routes.map((r) => {
      let handler;
      if (app.errorHandler === errorHandler) {
        handler = r.handler;
      } else {
        handler = async (c, next) => (await compose([], app.errorHandler)(c, () => r.handler(c, next))).res;
        handler[COMPOSED_HANDLER] = r.handler;
      }
      subApp.#addRoute(r.method, r.path, handler, r.basePath);
    });
    return this;
  }
  /**
   * `.basePath()` allows base paths to be specified.
   *
   * @see {@link https://hono.dev/docs/api/routing#base-path}
   *
   * @param {string} path - base Path
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * const api = new Hono().basePath('/api')
   * ```
   */
  basePath(path) {
    const subApp = this.#clone();
    subApp._basePath = mergePath(this._basePath, path);
    return subApp;
  }
  /**
   * `.onError()` handles an error and returns a customized Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#error-handling}
   *
   * @param {ErrorHandler} handler - request Handler for error
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.onError((err, c) => {
   *   console.error(`${err}`)
   *   return c.text('Custom Error Message', 500)
   * })
   * ```
   */
  onError = (handler) => {
    this.errorHandler = handler;
    return this;
  };
  /**
   * `.notFound()` allows you to customize a Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#not-found}
   *
   * @param {NotFoundHandler} handler - request handler for not-found
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.notFound((c) => {
   *   return c.text('Custom 404 Message', 404)
   * })
   * ```
   */
  notFound = (handler) => {
    this.#notFoundHandler = handler;
    return this;
  };
  /**
   * `.mount()` allows you to mount applications built with other frameworks into your Hono application.
   *
   * @see {@link https://hono.dev/docs/api/hono#mount}
   *
   * @param {string} path - base Path
   * @param {Function} applicationHandler - other Request Handler
   * @param {MountOptions} [options] - options of `.mount()`
   * @returns {Hono} mounted Hono instance
   *
   * @example
   * ```ts
   * import { Router as IttyRouter } from 'itty-router'
   * import { Hono } from 'hono'
   * // Create itty-router application
   * const ittyRouter = IttyRouter()
   * // GET /itty-router/hello
   * ittyRouter.get('/hello', () => new Response('Hello from itty-router'))
   *
   * const app = new Hono()
   * app.mount('/itty-router', ittyRouter.handle)
   * ```
   *
   * @example
   * ```ts
   * const app = new Hono()
   * // Send the request to another application without modification.
   * app.mount('/app', anotherApp, {
   *   replaceRequest: (req) => req,
   * })
   * ```
   */
  mount(path, applicationHandler, options) {
    let replaceRequest;
    let optionHandler;
    if (options) {
      if (typeof options === "function") {
        optionHandler = options;
      } else {
        optionHandler = options.optionHandler;
        if (options.replaceRequest === false) {
          replaceRequest = (request) => request;
        } else {
          replaceRequest = options.replaceRequest;
        }
      }
    }
    const getOptions = optionHandler ? (c) => {
      const options2 = optionHandler(c);
      return Array.isArray(options2) ? options2 : [options2];
    } : (c) => {
      let executionContext = void 0;
      try {
        executionContext = c.executionCtx;
      } catch {
      }
      return [c.env, executionContext];
    };
    replaceRequest ||= (() => {
      const mergedPath = mergePath(this._basePath, path);
      const pathPrefixLength = mergedPath === "/" ? 0 : mergedPath.length;
      return (request) => {
        const url = new URL(request.url);
        url.pathname = this.getPath(request).slice(pathPrefixLength) || "/";
        return new Request(url, request);
      };
    })();
    const handler = async (c, next) => {
      const res = await applicationHandler(replaceRequest(c.req.raw), ...getOptions(c));
      if (res) {
        return res;
      }
      await next();
    };
    this.#addRoute(METHOD_NAME_ALL, mergePath(path, "*"), handler);
    return this;
  }
  #addRoute(method, path, handler, baseRoutePath) {
    method = method.toUpperCase();
    path = mergePath(this._basePath, path);
    const r = {
      basePath: baseRoutePath !== void 0 ? mergePath(this._basePath, baseRoutePath) : this._basePath,
      path,
      method,
      handler
    };
    this.router.add(method, path, [handler, r]);
    this.routes.push(r);
  }
  #handleError(err, c) {
    if (err instanceof Error) {
      return this.errorHandler(err, c);
    }
    throw err;
  }
  #dispatch(request, executionCtx, env, method) {
    if (method === "HEAD") {
      return (async () => new Response(null, await this.#dispatch(request, executionCtx, env, "GET")))();
    }
    const path = this.getPath(request, { env });
    const matchResult = this.router.match(method, path);
    const c = new Context(request, {
      path,
      matchResult,
      env,
      executionCtx,
      notFoundHandler: this.#notFoundHandler
    });
    if (matchResult[0].length === 1) {
      let res;
      try {
        res = matchResult[0][0][0][0](c, async () => {
          c.res = await this.#notFoundHandler(c);
        });
      } catch (err) {
        return this.#handleError(err, c);
      }
      return res instanceof Promise ? res.then(
        (resolved) => resolved || (c.finalized ? c.res : this.#notFoundHandler(c))
      ).catch((err) => this.#handleError(err, c)) : res ?? this.#notFoundHandler(c);
    }
    const composed = compose(matchResult[0], this.errorHandler, this.#notFoundHandler);
    return (async () => {
      try {
        const context = await composed(c);
        if (!context.finalized) {
          throw new Error(
            "Context is not finalized. Did you forget to return a Response object or `await next()`?"
          );
        }
        return context.res;
      } catch (err) {
        return this.#handleError(err, c);
      }
    })();
  }
  /**
   * `.fetch()` will be entry point of your app.
   *
   * @see {@link https://hono.dev/docs/api/hono#fetch}
   *
   * @param {Request} request - request Object of request
   * @param {Env} Env - env Object
   * @param {ExecutionContext} - context of execution
   * @returns {Response | Promise<Response>} response of request
   *
   */
  fetch = (request, ...rest) => {
    return this.#dispatch(request, rest[1], rest[0], request.method);
  };
  /**
   * `.request()` is a useful method for testing.
   * You can pass a URL or pathname to send a GET request.
   * app will return a Response object.
   * ```ts
   * test('GET /hello is ok', async () => {
   *   const res = await app.request('/hello')
   *   expect(res.status).toBe(200)
   * })
   * ```
   * @see https://hono.dev/docs/api/hono#request
   */
  request = (input, requestInit, Env, executionCtx) => {
    if (input instanceof Request) {
      return this.fetch(requestInit ? new Request(input, requestInit) : input, Env, executionCtx);
    }
    input = input.toString();
    return this.fetch(
      new Request(
        /^https?:\/\//.test(input) ? input : `http://localhost${mergePath("/", input)}`,
        requestInit
      ),
      Env,
      executionCtx
    );
  };
  /**
   * `.fire()` automatically adds a global fetch event listener.
   * This can be useful for environments that adhere to the Service Worker API, such as non-ES module Cloudflare Workers.
   * @deprecated
   * Use `fire` from `hono/service-worker` instead.
   * ```ts
   * import { Hono } from 'hono'
   * import { fire } from 'hono/service-worker'
   *
   * const app = new Hono()
   * // ...
   * fire(app)
   * ```
   * @see https://hono.dev/docs/api/hono#fire
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
   * @see https://developers.cloudflare.com/workers/reference/migrate-to-module-workers/
   */
  fire = () => {
    addEventListener("fetch", (event) => {
      event.respondWith(this.#dispatch(event.request, event, void 0, event.request.method));
    });
  };
};

// node_modules/hono/dist/router/reg-exp-router/matcher.js
var emptyParam = [];
function match(method, path) {
  const matchers = this.buildAllMatchers();
  const match2 = ((method2, path2) => {
    const matcher = matchers[method2] || matchers[METHOD_NAME_ALL];
    const staticMatch = matcher[2][path2];
    if (staticMatch) {
      return staticMatch;
    }
    const match3 = path2.match(matcher[0]);
    if (!match3) {
      return [[], emptyParam];
    }
    const index2 = match3.indexOf("", 1);
    return [matcher[1][index2], match3];
  });
  this.match = match2;
  return match2(method, path);
}

// node_modules/hono/dist/router/reg-exp-router/node.js
var LABEL_REG_EXP_STR = "[^/]+";
var ONLY_WILDCARD_REG_EXP_STR = ".*";
var TAIL_WILDCARD_REG_EXP_STR = "(?:|/.*)";
var PATH_ERROR = /* @__PURE__ */ Symbol();
var regExpMetaChars = new Set(".\\+*[^]$()");
function compareKey(a, b) {
  if (a.length === 1) {
    return b.length === 1 ? a < b ? -1 : 1 : -1;
  }
  if (b.length === 1) {
    return 1;
  }
  if (a === ONLY_WILDCARD_REG_EXP_STR || a === TAIL_WILDCARD_REG_EXP_STR) {
    return 1;
  } else if (b === ONLY_WILDCARD_REG_EXP_STR || b === TAIL_WILDCARD_REG_EXP_STR) {
    return -1;
  }
  if (a === LABEL_REG_EXP_STR) {
    return 1;
  } else if (b === LABEL_REG_EXP_STR) {
    return -1;
  }
  return a.length === b.length ? a < b ? -1 : 1 : b.length - a.length;
}
var Node = class _Node {
  #index;
  #varIndex;
  #children = /* @__PURE__ */ Object.create(null);
  insert(tokens, index2, paramMap, context, pathErrorCheckOnly) {
    if (tokens.length === 0) {
      if (this.#index !== void 0) {
        throw PATH_ERROR;
      }
      if (pathErrorCheckOnly) {
        return;
      }
      this.#index = index2;
      return;
    }
    const [token, ...restTokens] = tokens;
    const pattern = token === "*" ? restTokens.length === 0 ? ["", "", ONLY_WILDCARD_REG_EXP_STR] : ["", "", LABEL_REG_EXP_STR] : token === "/*" ? ["", "", TAIL_WILDCARD_REG_EXP_STR] : token.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
    let node;
    if (pattern) {
      const name = pattern[1];
      let regexpStr = pattern[2] || LABEL_REG_EXP_STR;
      if (name && pattern[2]) {
        if (regexpStr === ".*") {
          throw PATH_ERROR;
        }
        regexpStr = regexpStr.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:");
        if (/\((?!\?:)/.test(regexpStr)) {
          throw PATH_ERROR;
        }
      }
      node = this.#children[regexpStr];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k) => k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[regexpStr] = new _Node();
        if (name !== "") {
          node.#varIndex = context.varIndex++;
        }
      }
      if (!pathErrorCheckOnly && name !== "") {
        paramMap.push([name, node.#varIndex]);
      }
    } else {
      node = this.#children[token];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k) => k.length > 1 && k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[token] = new _Node();
      }
    }
    node.insert(restTokens, index2, paramMap, context, pathErrorCheckOnly);
  }
  buildRegExpStr() {
    const childKeys = Object.keys(this.#children).sort(compareKey);
    const strList = childKeys.map((k) => {
      const c = this.#children[k];
      return (typeof c.#varIndex === "number" ? `(${k})@${c.#varIndex}` : regExpMetaChars.has(k) ? `\\${k}` : k) + c.buildRegExpStr();
    });
    if (typeof this.#index === "number") {
      strList.unshift(`#${this.#index}`);
    }
    if (strList.length === 0) {
      return "";
    }
    if (strList.length === 1) {
      return strList[0];
    }
    return "(?:" + strList.join("|") + ")";
  }
};

// node_modules/hono/dist/router/reg-exp-router/trie.js
var Trie = class {
  #context = { varIndex: 0 };
  #root = new Node();
  insert(path, index2, pathErrorCheckOnly) {
    const paramAssoc = [];
    const groups = [];
    for (let i = 0; ; ) {
      let replaced = false;
      path = path.replace(/\{[^}]+\}/g, (m) => {
        const mark = `@\\${i}`;
        groups[i] = [mark, m];
        i++;
        replaced = true;
        return mark;
      });
      if (!replaced) {
        break;
      }
    }
    const tokens = path.match(/(?::[^\/]+)|(?:\/\*$)|./g) || [];
    for (let i = groups.length - 1; i >= 0; i--) {
      const [mark] = groups[i];
      for (let j = tokens.length - 1; j >= 0; j--) {
        if (tokens[j].indexOf(mark) !== -1) {
          tokens[j] = tokens[j].replace(mark, groups[i][1]);
          break;
        }
      }
    }
    this.#root.insert(tokens, index2, paramAssoc, this.#context, pathErrorCheckOnly);
    return paramAssoc;
  }
  buildRegExp() {
    let regexp = this.#root.buildRegExpStr();
    if (regexp === "") {
      return [/^$/, [], []];
    }
    let captureIndex = 0;
    const indexReplacementMap = [];
    const paramReplacementMap = [];
    regexp = regexp.replace(/#(\d+)|@(\d+)|\.\*\$/g, (_, handlerIndex, paramIndex) => {
      if (handlerIndex !== void 0) {
        indexReplacementMap[++captureIndex] = Number(handlerIndex);
        return "$()";
      }
      if (paramIndex !== void 0) {
        paramReplacementMap[Number(paramIndex)] = ++captureIndex;
        return "";
      }
      return "";
    });
    return [new RegExp(`^${regexp}`), indexReplacementMap, paramReplacementMap];
  }
};

// node_modules/hono/dist/router/reg-exp-router/router.js
var nullMatcher = [/^$/, [], /* @__PURE__ */ Object.create(null)];
var wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
function buildWildcardRegExp(path) {
  return wildcardRegExpCache[path] ??= new RegExp(
    path === "*" ? "" : `^${path.replace(
      /\/\*$|([.\\+*[^\]$()])/g,
      (_, metaChar) => metaChar ? `\\${metaChar}` : "(?:|/.*)"
    )}$`
  );
}
function clearWildcardRegExpCache() {
  wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
}
function buildMatcherFromPreprocessedRoutes(routes) {
  const trie = new Trie();
  const handlerData = [];
  if (routes.length === 0) {
    return nullMatcher;
  }
  const routesWithStaticPathFlag = routes.map(
    (route) => [!/\*|\/:/.test(route[0]), ...route]
  ).sort(
    ([isStaticA, pathA], [isStaticB, pathB]) => isStaticA ? 1 : isStaticB ? -1 : pathA.length - pathB.length
  );
  const staticMap = /* @__PURE__ */ Object.create(null);
  for (let i = 0, j = -1, len = routesWithStaticPathFlag.length; i < len; i++) {
    const [pathErrorCheckOnly, path, handlers] = routesWithStaticPathFlag[i];
    if (pathErrorCheckOnly) {
      staticMap[path] = [handlers.map(([h]) => [h, /* @__PURE__ */ Object.create(null)]), emptyParam];
    } else {
      j++;
    }
    let paramAssoc;
    try {
      paramAssoc = trie.insert(path, j, pathErrorCheckOnly);
    } catch (e) {
      throw e === PATH_ERROR ? new UnsupportedPathError(path) : e;
    }
    if (pathErrorCheckOnly) {
      continue;
    }
    handlerData[j] = handlers.map(([h, paramCount]) => {
      const paramIndexMap = /* @__PURE__ */ Object.create(null);
      paramCount -= 1;
      for (; paramCount >= 0; paramCount--) {
        const [key, value] = paramAssoc[paramCount];
        paramIndexMap[key] = value;
      }
      return [h, paramIndexMap];
    });
  }
  const [regexp, indexReplacementMap, paramReplacementMap] = trie.buildRegExp();
  for (let i = 0, len = handlerData.length; i < len; i++) {
    for (let j = 0, len2 = handlerData[i].length; j < len2; j++) {
      const map = handlerData[i][j]?.[1];
      if (!map) {
        continue;
      }
      const keys = Object.keys(map);
      for (let k = 0, len3 = keys.length; k < len3; k++) {
        map[keys[k]] = paramReplacementMap[map[keys[k]]];
      }
    }
  }
  const handlerMap = [];
  for (const i in indexReplacementMap) {
    handlerMap[i] = handlerData[indexReplacementMap[i]];
  }
  return [regexp, handlerMap, staticMap];
}
function findMiddleware(middleware, path) {
  if (!middleware) {
    return void 0;
  }
  for (const k of Object.keys(middleware).sort((a, b) => b.length - a.length)) {
    if (buildWildcardRegExp(k).test(path)) {
      return [...middleware[k]];
    }
  }
  return void 0;
}
var RegExpRouter = class {
  name = "RegExpRouter";
  #middleware;
  #routes;
  constructor() {
    this.#middleware = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
    this.#routes = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
  }
  add(method, path, handler) {
    const middleware = this.#middleware;
    const routes = this.#routes;
    if (!middleware || !routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    if (!middleware[method]) {
      ;
      [middleware, routes].forEach((handlerMap) => {
        handlerMap[method] = /* @__PURE__ */ Object.create(null);
        Object.keys(handlerMap[METHOD_NAME_ALL]).forEach((p) => {
          handlerMap[method][p] = [...handlerMap[METHOD_NAME_ALL][p]];
        });
      });
    }
    if (path === "/*") {
      path = "*";
    }
    const paramCount = (path.match(/\/:/g) || []).length;
    if (/\*$/.test(path)) {
      const re = buildWildcardRegExp(path);
      if (method === METHOD_NAME_ALL) {
        Object.keys(middleware).forEach((m) => {
          middleware[m][path] ||= findMiddleware(middleware[m], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
        });
      } else {
        middleware[method][path] ||= findMiddleware(middleware[method], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
      }
      Object.keys(middleware).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(middleware[m]).forEach((p) => {
            re.test(p) && middleware[m][p].push([handler, paramCount]);
          });
        }
      });
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(routes[m]).forEach(
            (p) => re.test(p) && routes[m][p].push([handler, paramCount])
          );
        }
      });
      return;
    }
    const paths = checkOptionalParameter(path) || [path];
    for (let i = 0, len = paths.length; i < len; i++) {
      const path2 = paths[i];
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          routes[m][path2] ||= [
            ...findMiddleware(middleware[m], path2) || findMiddleware(middleware[METHOD_NAME_ALL], path2) || []
          ];
          routes[m][path2].push([handler, paramCount - len + i + 1]);
        }
      });
    }
  }
  match = match;
  buildAllMatchers() {
    const matchers = /* @__PURE__ */ Object.create(null);
    Object.keys(this.#routes).concat(Object.keys(this.#middleware)).forEach((method) => {
      matchers[method] ||= this.#buildMatcher(method);
    });
    this.#middleware = this.#routes = void 0;
    clearWildcardRegExpCache();
    return matchers;
  }
  #buildMatcher(method) {
    const routes = [];
    let hasOwnRoute = method === METHOD_NAME_ALL;
    [this.#middleware, this.#routes].forEach((r) => {
      const ownRoute = r[method] ? Object.keys(r[method]).map((path) => [path, r[method][path]]) : [];
      if (ownRoute.length !== 0) {
        hasOwnRoute ||= true;
        routes.push(...ownRoute);
      } else if (method !== METHOD_NAME_ALL) {
        routes.push(
          ...Object.keys(r[METHOD_NAME_ALL]).map((path) => [path, r[METHOD_NAME_ALL][path]])
        );
      }
    });
    if (!hasOwnRoute) {
      return null;
    } else {
      return buildMatcherFromPreprocessedRoutes(routes);
    }
  }
};

// node_modules/hono/dist/router/smart-router/router.js
var SmartRouter = class {
  name = "SmartRouter";
  #routers = [];
  #routes = [];
  constructor(init) {
    this.#routers = init.routers;
  }
  add(method, path, handler) {
    if (!this.#routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    this.#routes.push([method, path, handler]);
  }
  match(method, path) {
    if (!this.#routes) {
      throw new Error("Fatal error");
    }
    const routers = this.#routers;
    const routes = this.#routes;
    const len = routers.length;
    let i = 0;
    let res;
    for (; i < len; i++) {
      const router = routers[i];
      try {
        for (let i2 = 0, len2 = routes.length; i2 < len2; i2++) {
          router.add(...routes[i2]);
        }
        res = router.match(method, path);
      } catch (e) {
        if (e instanceof UnsupportedPathError) {
          continue;
        }
        throw e;
      }
      this.match = router.match.bind(router);
      this.#routers = [router];
      this.#routes = void 0;
      break;
    }
    if (i === len) {
      throw new Error("Fatal error");
    }
    this.name = `SmartRouter + ${this.activeRouter.name}`;
    return res;
  }
  get activeRouter() {
    if (this.#routes || this.#routers.length !== 1) {
      throw new Error("No active router has been determined yet.");
    }
    return this.#routers[0];
  }
};

// node_modules/hono/dist/router/trie-router/node.js
var emptyParams = /* @__PURE__ */ Object.create(null);
var hasChildren = (children) => {
  for (const _ in children) {
    return true;
  }
  return false;
};
var Node2 = class _Node2 {
  #methods;
  #children;
  #patterns;
  #order = 0;
  #params = emptyParams;
  constructor(method, handler, children) {
    this.#children = children || /* @__PURE__ */ Object.create(null);
    this.#methods = [];
    if (method && handler) {
      const m = /* @__PURE__ */ Object.create(null);
      m[method] = { handler, possibleKeys: [], score: 0 };
      this.#methods = [m];
    }
    this.#patterns = [];
  }
  insert(method, path, handler) {
    this.#order = ++this.#order;
    let curNode = this;
    const parts = splitRoutingPath(path);
    const possibleKeys = [];
    for (let i = 0, len = parts.length; i < len; i++) {
      const p = parts[i];
      const nextP = parts[i + 1];
      const pattern = getPattern(p, nextP);
      const key = Array.isArray(pattern) ? pattern[0] : p;
      if (key in curNode.#children) {
        curNode = curNode.#children[key];
        if (pattern) {
          possibleKeys.push(pattern[1]);
        }
        continue;
      }
      curNode.#children[key] = new _Node2();
      if (pattern) {
        curNode.#patterns.push(pattern);
        possibleKeys.push(pattern[1]);
      }
      curNode = curNode.#children[key];
    }
    curNode.#methods.push({
      [method]: {
        handler,
        possibleKeys: possibleKeys.filter((v, i, a) => a.indexOf(v) === i),
        score: this.#order
      }
    });
    return curNode;
  }
  #pushHandlerSets(handlerSets, node, method, nodeParams, params) {
    for (let i = 0, len = node.#methods.length; i < len; i++) {
      const m = node.#methods[i];
      const handlerSet = m[method] || m[METHOD_NAME_ALL];
      const processedSet = {};
      if (handlerSet !== void 0) {
        handlerSet.params = /* @__PURE__ */ Object.create(null);
        handlerSets.push(handlerSet);
        if (nodeParams !== emptyParams || params && params !== emptyParams) {
          for (let i2 = 0, len2 = handlerSet.possibleKeys.length; i2 < len2; i2++) {
            const key = handlerSet.possibleKeys[i2];
            const processed = processedSet[handlerSet.score];
            handlerSet.params[key] = params?.[key] && !processed ? params[key] : nodeParams[key] ?? params?.[key];
            processedSet[handlerSet.score] = true;
          }
        }
      }
    }
  }
  search(method, path) {
    const handlerSets = [];
    this.#params = emptyParams;
    const curNode = this;
    let curNodes = [curNode];
    const parts = splitPath(path);
    const curNodesQueue = [];
    const len = parts.length;
    let partOffsets = null;
    for (let i = 0; i < len; i++) {
      const part = parts[i];
      const isLast = i === len - 1;
      const tempNodes = [];
      for (let j = 0, len2 = curNodes.length; j < len2; j++) {
        const node = curNodes[j];
        const nextNode = node.#children[part];
        if (nextNode) {
          nextNode.#params = node.#params;
          if (isLast) {
            if (nextNode.#children["*"]) {
              this.#pushHandlerSets(handlerSets, nextNode.#children["*"], method, node.#params);
            }
            this.#pushHandlerSets(handlerSets, nextNode, method, node.#params);
          } else {
            tempNodes.push(nextNode);
          }
        }
        for (let k = 0, len3 = node.#patterns.length; k < len3; k++) {
          const pattern = node.#patterns[k];
          const params = node.#params === emptyParams ? {} : { ...node.#params };
          if (pattern === "*") {
            const astNode = node.#children["*"];
            if (astNode) {
              this.#pushHandlerSets(handlerSets, astNode, method, node.#params);
              astNode.#params = params;
              tempNodes.push(astNode);
            }
            continue;
          }
          const [key, name, matcher] = pattern;
          if (!part && !(matcher instanceof RegExp)) {
            continue;
          }
          const child = node.#children[key];
          if (matcher instanceof RegExp) {
            if (partOffsets === null) {
              partOffsets = new Array(len);
              let offset = path[0] === "/" ? 1 : 0;
              for (let p = 0; p < len; p++) {
                partOffsets[p] = offset;
                offset += parts[p].length + 1;
              }
            }
            const restPathString = path.substring(partOffsets[i]);
            const m = matcher.exec(restPathString);
            if (m) {
              params[name] = m[0];
              this.#pushHandlerSets(handlerSets, child, method, node.#params, params);
              if (hasChildren(child.#children)) {
                child.#params = params;
                const componentCount = m[0].match(/\//)?.length ?? 0;
                const targetCurNodes = curNodesQueue[componentCount] ||= [];
                targetCurNodes.push(child);
              }
              continue;
            }
          }
          if (matcher === true || matcher.test(part)) {
            params[name] = part;
            if (isLast) {
              this.#pushHandlerSets(handlerSets, child, method, params, node.#params);
              if (child.#children["*"]) {
                this.#pushHandlerSets(
                  handlerSets,
                  child.#children["*"],
                  method,
                  params,
                  node.#params
                );
              }
            } else {
              child.#params = params;
              tempNodes.push(child);
            }
          }
        }
      }
      const shifted = curNodesQueue.shift();
      curNodes = shifted ? tempNodes.concat(shifted) : tempNodes;
    }
    if (handlerSets.length > 1) {
      handlerSets.sort((a, b) => {
        return a.score - b.score;
      });
    }
    return [handlerSets.map(({ handler, params }) => [handler, params])];
  }
};

// node_modules/hono/dist/router/trie-router/router.js
var TrieRouter = class {
  name = "TrieRouter";
  #node;
  constructor() {
    this.#node = new Node2();
  }
  add(method, path, handler) {
    const results = checkOptionalParameter(path);
    if (results) {
      for (let i = 0, len = results.length; i < len; i++) {
        this.#node.insert(method, results[i], handler);
      }
      return;
    }
    this.#node.insert(method, path, handler);
  }
  match(method, path) {
    return this.#node.search(method, path);
  }
};

// node_modules/hono/dist/hono.js
var Hono2 = class extends Hono {
  /**
   * Creates an instance of the Hono class.
   *
   * @param options - Optional configuration options for the Hono instance.
   */
  constructor(options = {}) {
    super(options);
    this.router = options.router ?? new SmartRouter({
      routers: [new RegExpRouter(), new TrieRouter()]
    });
  }
};

// src/__generated__/db_schema.ts
var db_schema_exports = {};
__export(db_schema_exports, {
  esSystemAuthUser: () => esSystemAuthUser,
  inspections: () => inspections,
  items: () => items,
  orders: () => orders,
  parties: () => parties,
  paymentPrices: () => paymentPrices,
  payments: () => payments,
  photos: () => photos,
  propertyDetails: () => propertyDetails,
  rooms: () => rooms,
  signatures: () => signatures,
  tenancyDetails: () => tenancyDetails,
  userProfiles: () => userProfiles,
  users: () => users
});
import { sqliteTable, uniqueIndex, text, integer, index, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
var esSystemAuthUser = sqliteTable(
  "es_system__auth_user",
  {
    id: text().primaryKey().notNull(),
    name: text().notNull(),
    email: text().notNull(),
    emailVerified: integer("email_verified").default(0).notNull(),
    image: text(),
    createdAt: integer("created_at").default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`).notNull(),
    updatedAt: integer("updated_at").default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`).notNull(),
    isAnonymous: integer("is_anonymous").default(0),
    internalA: text("__internal_a"),
    banned: integer().default(0),
    banReason: text("ban_reason"),
    banExpires: integer("ban_expires"),
    lastLoginAt: integer("last_login_at")
  },
  (table) => [
    uniqueIndex("es_system__auth_user_email_unique").on(table.email)
  ]
);
var inspections = sqliteTable(
  "inspections",
  {
    id: text().primaryKey(),
    userId: text("user_id").notNull(),
    propertyType: text("property_type").default("apartment").notNull(),
    status: text().default("draft").notNull(),
    generalNotes: text("general_notes").default(""),
    propertyData: text("property_data").default("{}"),
    tenantData: text("tenant_data").default("{}"),
    landlordData: text("landlord_data").default("{}"),
    agentData: text("agent_data").default("{}"),
    tenancyData: text("tenancy_data").default("{}"),
    roomsData: text("rooms_data").default("[]"),
    propertyItems: text("property_items").default("[]"),
    signatures: text().default("[]"),
    overallPhotos: text("overall_photos").default("[]"),
    paymentData: text("payment_data").default("{}"),
    reportGenerated: integer("report_generated").default(0),
    createdAt: text("created_at").default("sql`(datetime('now'))`").notNull(),
    updatedAt: text("updated_at").default("sql`(datetime('now'))`").notNull(),
    completedAt: text("completed_at"),
    pdfUrl: text("pdf_url").default("")
  },
  (table) => [
    index("idx_inspections_created_at").on(table.createdAt),
    index("idx_inspections_status").on(table.status),
    index("idx_inspections_user_id").on(table.userId)
  ]
);
var users = sqliteTable(
  "users",
  {
    id: text().primaryKey(),
    email: text().notNull(),
    name: text().notNull(),
    phone: text().default(""),
    location: text().default(""),
    createdAt: text("created_at").default("sql`(datetime('now'))`").notNull(),
    updatedAt: text("updated_at").default("sql`(datetime('now'))`").notNull(),
    passwordHash: text("password_hash").default("")
  },
  (table) => [
    index("idx_users_email").on(table.email)
  ]
);
var parties = sqliteTable(
  "parties",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    inspectionId: text("inspection_id").notNull().references(() => inspections.id, { onDelete: "cascade" }),
    role: text().notNull(),
    name: text().default(""),
    phone: text().default(""),
    email: text().default(""),
    companyName: text("company_name").default(""),
    tradeLicense: text("trade_license").default(""),
    createdAt: text("created_at").default("sql`(datetime('now'))`").notNull()
  },
  (table) => [
    index("idx_parties_inspection").on(table.inspectionId)
  ]
);
var tenancyDetails = sqliteTable(
  "tenancy_details",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    inspectionId: text("inspection_id").notNull().references(() => inspections.id, { onDelete: "cascade" }),
    leaseStart: text("lease_start").default(""),
    leaseEnd: text("lease_end").default(""),
    contractNumber: text("contract_number").default(""),
    createdAt: text("created_at").default("sql`(datetime('now'))`").notNull()
  },
  (table) => [
    index("idx_tenancy_inspection").on(table.inspectionId)
  ]
);
var paymentPrices = sqliteTable(
  "payment_prices",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    environment: text().default("staging").notNull(),
    name: text().notNull(),
    description: text(),
    amount: integer().notNull(),
    currency: text().default("AED"),
    type: text().default("one_time"),
    interval: text(),
    provider: text().default("stripe").notNull(),
    providerProductId: text("provider_product_id"),
    providerPriceId: text("provider_price_id"),
    active: integer().default(1),
    metadata: text(),
    createdAt: integer("created_at").default(sql`(unixepoch())`)
  },
  (table) => [
    index("idx_prices_env").on(table.environment, table.provider, table.providerPriceId)
  ]
);
var orders = sqliteTable(
  "orders",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    environment: text().default("staging").notNull(),
    userId: text("user_id").notNull(),
    inspectionId: text("inspection_id"),
    priceId: integer("price_id").references(() => paymentPrices.id),
    amount: integer().notNull(),
    currency: text().default("AED"),
    status: text().default("pending"),
    type: text().default("one_time"),
    provider: text().default("stripe"),
    providerSessionId: text("provider_session_id"),
    providerPaymentId: text("provider_payment_id"),
    discountCode: text("discount_code"),
    discountAmount: integer("discount_amount").default(0),
    metadata: text(),
    paidAt: integer("paid_at"),
    createdAt: integer("created_at").default(sql`(unixepoch())`)
  },
  (table) => [
    index("idx_orders_env_status").on(table.environment, table.status),
    index("idx_orders_env_user").on(table.environment, table.userId)
  ]
);
var propertyDetails = sqliteTable("property_details", {
  id: integer().primaryKey({ autoIncrement: true }),
  inspectionId: text("inspection_id").notNull().references(() => inspections.id, { onDelete: "cascade" }),
  makaniNumber: text("makani_number").default(""),
  area: text().default(""),
  city: text().default("Dubai"),
  buildingName: text("building_name").default(""),
  unitNumber: text("unit_number").default(""),
  totalAreaSqft: integer("total_area_sqft"),
  bedrooms: integer().default(1),
  bathrooms: integer().default(1),
  furnished: integer().default(0),
  specialFeatures: text("special_features").default("[]")
});
var items = sqliteTable("items", {
  id: text().primaryKey(),
  roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
  name: text().notNull(),
  category: text().default(""),
  condition: text(),
  comments: text().default(""),
  checked: integer().default(0),
  sortOrder: integer("sort_order").default(0)
});
var photos = sqliteTable("photos", {
  id: text().primaryKey(),
  itemId: text("item_id").references(() => items.id, { onDelete: "cascade" }),
  inspectionId: text("inspection_id").notNull().references(() => inspections.id, { onDelete: "cascade" }),
  photoType: text("photo_type").default("item").notNull(),
  url: text().notNull(),
  caption: text().default(""),
  timestamp: text().notNull(),
  gpsLat: real("gps_lat"),
  gpsLng: real("gps_lng"),
  sortOrder: integer("sort_order").default(0)
});
var signatures = sqliteTable("signatures", {
  id: integer().primaryKey({ autoIncrement: true }),
  inspectionId: text("inspection_id").notNull().references(() => inspections.id, { onDelete: "cascade" }),
  role: text().notNull(),
  name: text().notNull(),
  dataUrl: text("data_url").notNull(),
  signedAt: text("signed_at").notNull()
});
var rooms = sqliteTable("rooms", {
  id: text().primaryKey(),
  inspectionId: text("inspection_id").notNull().references(() => inspections.id, { onDelete: "cascade" }),
  name: text().notNull(),
  roomType: text("room_type").notNull(),
  icon: text().default("\u{1F3E0}"),
  overallComments: text("overall_comments").default(""),
  overallCondition: text("overall_condition"),
  sortOrder: integer("sort_order").default(0)
});
var payments = sqliteTable("payments", {
  id: integer().primaryKey({ autoIncrement: true }),
  inspectionId: text("inspection_id").notNull().references(() => inspections.id, { onDelete: "cascade" }),
  paid: integer().default(0),
  amount: integer().default(0),
  currency: text().default("AED"),
  method: text().default("card"),
  paidAt: text("paid_at"),
  transactionId: text("transaction_id")
});
var userProfiles = sqliteTable(
  "user_profiles",
  {
    id: text().primaryKey(),
    userId: text("user_id").notNull(),
    phone: text().default(""),
    location: text().default(""),
    inspectorName: text("inspector_name").default(""),
    inspectorEmail: text("inspector_email").default(""),
    createdAt: text("created_at").default("sql`(datetime('now'))`").notNull(),
    updatedAt: text("updated_at").default("sql`(datetime('now'))`").notNull()
  },
  (table) => [
    index("idx_user_profiles_user_id").on(table.userId)
  ]
);

// src/__generated__/storage_schema.ts
var storage_schema_exports = {};
__export(storage_schema_exports, {
  meinspect_reports: () => meinspect_reports
});
var meinspect_reports = {
  bucket_name: "meinspect-reports",
  description: "Inspection reports and photos"
};

// src/__generated__/db_relations.ts
var db_relations_exports = {};
__export(db_relations_exports, {
  inspectionsRelations: () => inspectionsRelations,
  itemsRelations: () => itemsRelations,
  ordersRelations: () => ordersRelations,
  partiesRelations: () => partiesRelations,
  paymentPricesRelations: () => paymentPricesRelations,
  paymentsRelations: () => paymentsRelations,
  photosRelations: () => photosRelations,
  propertyDetailsRelations: () => propertyDetailsRelations,
  roomsRelations: () => roomsRelations,
  signaturesRelations: () => signaturesRelations,
  tenancyDetailsRelations: () => tenancyDetailsRelations
});
import { relations } from "drizzle-orm/relations";
var partiesRelations = relations(parties, ({ one }) => ({
  inspection: one(inspections, {
    fields: [parties.inspectionId],
    references: [inspections.id]
  })
}));
var inspectionsRelations = relations(inspections, ({ many }) => ({
  parties: many(parties),
  tenancyDetails: many(tenancyDetails),
  propertyDetails: many(propertyDetails),
  photos: many(photos),
  signatures: many(signatures),
  rooms: many(rooms),
  payments: many(payments)
}));
var tenancyDetailsRelations = relations(tenancyDetails, ({ one }) => ({
  inspection: one(inspections, {
    fields: [tenancyDetails.inspectionId],
    references: [inspections.id]
  })
}));
var ordersRelations = relations(orders, ({ one }) => ({
  paymentPrice: one(paymentPrices, {
    fields: [orders.priceId],
    references: [paymentPrices.id]
  })
}));
var paymentPricesRelations = relations(paymentPrices, ({ many }) => ({
  orders: many(orders)
}));
var propertyDetailsRelations = relations(propertyDetails, ({ one }) => ({
  inspection: one(inspections, {
    fields: [propertyDetails.inspectionId],
    references: [inspections.id]
  })
}));
var itemsRelations = relations(items, ({ one, many }) => ({
  room: one(rooms, {
    fields: [items.roomId],
    references: [rooms.id]
  }),
  photos: many(photos)
}));
var roomsRelations = relations(rooms, ({ one, many }) => ({
  items: many(items),
  inspection: one(inspections, {
    fields: [rooms.inspectionId],
    references: [inspections.id]
  })
}));
var photosRelations = relations(photos, ({ one }) => ({
  inspection: one(inspections, {
    fields: [photos.inspectionId],
    references: [inspections.id]
  }),
  item: one(items, {
    fields: [photos.itemId],
    references: [items.id]
  })
}));
var signaturesRelations = relations(signatures, ({ one }) => ({
  inspection: one(inspections, {
    fields: [signatures.inspectionId],
    references: [inspections.id]
  })
}));
var paymentsRelations = relations(payments, ({ one }) => ({
  inspection: one(inspections, {
    fields: [payments.inspectionId],
    references: [inspections.id]
  })
}));

// src/__generated__/index.ts
var drizzleSchema = { ...db_schema_exports, ...db_relations_exports };

// src/index.ts
import { eq } from "drizzle-orm";
var PROVIDER = "stripe";
function getEnv() {
  return "staging";
}
function tryParse(json) {
  if (!json) return {};
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}
async function createApp(edgespark) {
  const app = new Hono2();
  app.onError((err, c) => {
    console.error("[API] error:", err);
    return c.json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  });
  app.post("/api/public/auth/signup", async (c) => {
    const { email, password, name, phone, location } = await c.req.json();
    if (!email || !password || !name) {
      return c.json({ error: "Email, password, and name are required" }, 400);
    }
    const existing = await edgespark.db.select().from(db_schema_exports.users).where(eq(db_schema_exports.users.email, email));
    if (existing.length > 0) {
      return c.json({ error: "An account with this email already exists" }, 409);
    }
    const encoder = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveBits"]
    );
    const hash = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations: 1e5, hash: "SHA-256" },
      keyMaterial,
      256
    );
    const hashArray = Array.from(new Uint8Array(hash));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    const saltHex = Array.from(salt).map((b) => b.toString(16).padStart(2, "0")).join("");
    const passwordHash = `${saltHex}:${hashHex}`;
    await edgespark.db.insert(db_schema_exports.users).values({
      id: email,
      email,
      name,
      phone: phone || "",
      location: location || "",
      passwordHash
    });
    const token = await createToken(email);
    return c.json({
      success: true,
      user: { id: email, email, name },
      token
    });
  });
  app.post("/api/public/auth/login", async (c) => {
    const { email, password } = await c.req.json();
    if (!email || !password) {
      return c.json({ error: "Email and password are required" }, 400);
    }
    const users2 = await edgespark.db.select().from(db_schema_exports.users).where(eq(db_schema_exports.users.email, email));
    if (users2.length === 0) {
      return c.json({ error: "No account found with this email" }, 401);
    }
    const user = users2[0];
    if (!user.passwordHash) {
      return c.json({ error: "Account has no password set" }, 401);
    }
    const [saltHex, hashHex] = user.passwordHash.split(":");
    const encoder = new TextEncoder();
    const salt = new Uint8Array(saltHex.match(/.{2}/g).map((b) => parseInt(b, 16)));
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveBits"]
    );
    const hash = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations: 1e5, hash: "SHA-256" },
      keyMaterial,
      256
    );
    const hashArray = Array.from(new Uint8Array(hash));
    const computedHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    if (computedHash !== hashHex) {
      return c.json({ error: "Incorrect password" }, 401);
    }
    const token = await createToken(email);
    return c.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name },
      token
    });
  });
  app.get("/api/public/auth/me", async (c) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json({ error: "Not authenticated" }, 401);
    }
    const token = authHeader.slice(7);
    const email = await verifyToken(token);
    if (!email) {
      return c.json({ error: "Invalid token" }, 401);
    }
    const users2 = await edgespark.db.select().from(db_schema_exports.users).where(eq(db_schema_exports.users.email, email));
    if (users2.length === 0) {
      return c.json({ error: "User not found" }, 404);
    }
    const user = users2[0];
    return c.json({
      user: { id: user.id, email: user.email, name: user.name }
    });
  });
  async function createToken(email) {
    const encoder = new TextEncoder();
    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const payload = btoa(JSON.stringify({
      sub: email,
      iat: Math.floor(Date.now() / 1e3),
      exp: Math.floor(Date.now() / 1e3) + 86400 * 7
    }));
    const data = `${header}.${payload}`;
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode("meinspect-secret-key-2024"),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
    const sigHex = Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, "0")).join("");
    return `${data}.${sigHex}`;
  }
  async function verifyToken(token) {
    try {
      const [header, payload, sigHex] = token.split(".");
      if (!header || !payload || !sigHex) return null;
      const encoder = new TextEncoder();
      const data = `${header}.${payload}`;
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode("meinspect-secret-key-2024"),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"]
      );
      const sigBytes = new Uint8Array(sigHex.match(/.{2}/g).map((b) => parseInt(b, 16)));
      const valid = await crypto.subtle.verify("HMAC", key, sigBytes, encoder.encode(data));
      if (!valid) return null;
      const payloadData = JSON.parse(atob(payload));
      if (payloadData.exp < Math.floor(Date.now() / 1e3)) return null;
      return payloadData.sub;
    } catch {
      return null;
    }
  }
  app.post("/api/public/user/profile", async (c) => {
    const { email, phone, location } = await c.req.json();
    if (!email) return c.json({ error: "email required" }, 400);
    const existing = await edgespark.db.select().from(db_schema_exports.users).where(eq(db_schema_exports.users.email, email));
    if (existing.length > 0) {
      await edgespark.db.update(db_schema_exports.users).set({
        phone: phone || existing[0].phone,
        location: location || existing[0].location,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      }).where(eq(db_schema_exports.users.email, email));
    } else {
      await edgespark.db.insert(db_schema_exports.users).values({
        id: email,
        email,
        name: "",
        phone: phone || "",
        location: location || ""
      });
    }
    return c.json({ success: true });
  });
  app.get("/api/public/user/profile/:email", async (c) => {
    const email = c.req.param("email");
    const result = await edgespark.db.select().from(db_schema_exports.users).where(eq(db_schema_exports.users.email, email));
    if (result.length === 0) return c.json({ data: null });
    return c.json({ data: result[0] });
  });
  app.get("/api/inspections", async (c) => {
    const userId = edgespark.auth.user.id;
    const inspections2 = await edgespark.db.select().from(db_schema_exports.inspections).where(eq(db_schema_exports.inspections.userId, userId));
    return c.json({ data: inspections2 });
  });
  app.get("/api/inspections/:id", async (c) => {
    const id = c.req.param("id");
    const result = await edgespark.db.select().from(db_schema_exports.inspections).where(eq(db_schema_exports.inspections.id, id));
    if (result.length === 0) return c.json({ error: "Not found" }, 404);
    return c.json({ data: result[0] });
  });
  app.post("/api/inspections", async (c) => {
    const data = await c.req.json();
    const userId = edgespark.auth.user.id;
    const inspection = await edgespark.db.insert(db_schema_exports.inspections).values({
      id: data.id,
      userId,
      propertyType: data.propertyType || "apartment",
      status: data.status || "draft",
      generalNotes: data.generalNotes || "",
      propertyData: JSON.stringify(data.property || {}),
      tenantData: JSON.stringify(data.tenant || {}),
      landlordData: JSON.stringify(data.landlord || {}),
      agentData: JSON.stringify(data.agent || {}),
      tenancyData: JSON.stringify(data.tenancy || {}),
      roomsData: JSON.stringify(data.rooms || []),
      propertyItems: JSON.stringify(data.propertyItems || []),
      signatures: JSON.stringify(data.signatures || []),
      overallPhotos: JSON.stringify(data.overallPhotos || []),
      paymentData: JSON.stringify(data.payment || {}),
      reportGenerated: data.reportGenerated ? 1 : 0,
      pdfUrl: data.pdfUrl || ""
    }).returning();
    return c.json({ data: inspection[0] }, 201);
  });
  app.put("/api/inspections/:id", async (c) => {
    const id = c.req.param("id");
    const data = await c.req.json();
    const existing = await edgespark.db.select().from(db_schema_exports.inspections).where(eq(db_schema_exports.inspections.id, id));
    if (existing.length === 0) {
      return c.json({ error: "Inspection not found" }, 404);
    }
    const updateData = { updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    if (data.status !== void 0) updateData.status = data.status;
    if (data.generalNotes !== void 0) updateData.generalNotes = data.generalNotes;
    if (data.property !== void 0) updateData.propertyData = JSON.stringify(data.property);
    if (data.tenant !== void 0) updateData.tenantData = JSON.stringify(data.tenant);
    if (data.landlord !== void 0) updateData.landlordData = JSON.stringify(data.landlord);
    if (data.agent !== void 0) updateData.agentData = JSON.stringify(data.agent);
    if (data.tenancy !== void 0) updateData.tenancyData = JSON.stringify(data.tenancy);
    if (data.rooms !== void 0) updateData.roomsData = JSON.stringify(data.rooms);
    if (data.propertyItems !== void 0) updateData.propertyItems = JSON.stringify(data.propertyItems);
    if (data.signatures !== void 0) updateData.signatures = JSON.stringify(data.signatures);
    if (data.overallPhotos !== void 0) updateData.overallPhotos = JSON.stringify(data.overallPhotos);
    if (data.payment !== void 0) updateData.paymentData = JSON.stringify(data.payment);
    if (data.reportGenerated !== void 0) updateData.reportGenerated = data.reportGenerated ? 1 : 0;
    if (data.completedAt !== void 0) updateData.completedAt = data.completedAt;
    if (data.pdfUrl !== void 0) updateData.pdfUrl = data.pdfUrl;
    await edgespark.db.update(db_schema_exports.inspections).set(updateData).where(eq(db_schema_exports.inspections.id, id));
    return c.json({ success: true });
  });
  app.delete("/api/inspections/:id", async (c) => {
    const id = c.req.param("id");
    await edgespark.db.delete(db_schema_exports.inspections).where(eq(db_schema_exports.inspections.id, id));
    return c.json({ success: true });
  });
  app.post("/api/public/send-email", async (c) => {
    const { to, subject, html, from } = await c.req.json();
    if (!to || !subject || !html) {
      return c.json({ error: "to, subject, and html are required" }, 400);
    }
    const apiKey = edgespark.secret.get("RESEND_API_KEY");
    if (!apiKey) {
      return c.json({ error: "Email service not configured (RESEND_API_KEY missing)" }, 500);
    }
    const fromAddress = from || "MeInspect <onboarding@resend.dev>";
    const recipients = Array.isArray(to) ? to : [to];
    try {
      const results = [];
      for (const recipient of recipients) {
        try {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              from: fromAddress,
              to: [recipient],
              subject,
              html
            })
          });
          const data = await res.json();
          if (res.ok) {
            results.push({ email: recipient, success: true, id: data.id });
          } else {
            results.push({ email: recipient, success: false, error: data.message || "Send failed" });
          }
        } catch (err) {
          results.push({
            email: recipient,
            success: false,
            error: err instanceof Error ? err.message : "Network error"
          });
        }
      }
      const allSuccess = results.every((r) => r.success);
      return c.json({
        success: allSuccess,
        results,
        sentCount: results.filter((r) => r.success).length,
        failedCount: results.filter((r) => !r.success).length
      });
    } catch (err) {
      return c.json({
        error: err instanceof Error ? err.message : "Email sending failed"
      }, 500);
    }
  });
  app.get("/api/sync/inspections", async (c) => {
    const userId = edgespark.auth.user.id;
    const inspections2 = await edgespark.db.select().from(db_schema_exports.inspections).where(eq(db_schema_exports.inspections.userId, userId));
    const parsed = inspections2.map((row) => ({
      id: row.id,
      userId: row.userId,
      propertyType: row.propertyType,
      status: row.status,
      generalNotes: row.generalNotes,
      reportGenerated: row.reportGenerated,
      pdfUrl: row.pdfUrl || "",
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      completedAt: row.completedAt,
      property: tryParse(row.propertyData),
      tenant: tryParse(row.tenantData),
      landlord: tryParse(row.landlordData),
      agent: tryParse(row.agentData),
      tenancy: tryParse(row.tenancyData),
      rooms: tryParse(row.roomsData),
      propertyItems: tryParse(row.propertyItems),
      signatures: tryParse(row.signatures),
      overallPhotos: tryParse(row.overallPhotos),
      payment: tryParse(row.paymentData)
    }));
    return c.json({ data: parsed, count: parsed.length });
  });
  app.post("/api/sync/push", async (c) => {
    const userId = edgespark.auth.user.id;
    const { inspections: items2 } = await c.req.json();
    if (!Array.isArray(items2)) return c.json({ error: "inspections array required" }, 400);
    let created = 0;
    let updated = 0;
    for (const inspection of items2) {
      try {
        const existing = await edgespark.db.select().from(db_schema_exports.inspections).where(eq(db_schema_exports.inspections.id, inspection.id));
        const updateData = {
          status: inspection.status,
          generalNotes: inspection.generalNotes || "",
          propertyType: inspection.propertyType || "apartment",
          propertyData: JSON.stringify(inspection.property || {}),
          tenantData: JSON.stringify(inspection.tenant || {}),
          landlordData: JSON.stringify(inspection.landlord || {}),
          agentData: JSON.stringify(inspection.agent || {}),
          tenancyData: JSON.stringify(inspection.tenancy || {}),
          roomsData: JSON.stringify(inspection.rooms || []),
          propertyItems: JSON.stringify(inspection.propertyItems || []),
          signatures: JSON.stringify(inspection.signatures || []),
          overallPhotos: JSON.stringify(inspection.overallPhotos || []),
          paymentData: JSON.stringify(inspection.payment || {}),
          reportGenerated: inspection.reportGenerated ? 1 : 0,
          pdfUrl: inspection.pdfUrl || "",
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        if (inspection.completedAt) updateData.completedAt = inspection.completedAt;
        if (existing.length > 0) {
          await edgespark.db.update(db_schema_exports.inspections).set(updateData).where(eq(db_schema_exports.inspections.id, inspection.id));
          updated++;
        } else {
          await edgespark.db.insert(db_schema_exports.inspections).values({
            id: inspection.id,
            userId,
            ...updateData,
            createdAt: inspection.createdAt || (/* @__PURE__ */ new Date()).toISOString()
          });
          created++;
        }
      } catch (err) {
        console.warn(`Failed to sync inspection ${inspection.id}:`, err);
      }
    }
    return c.json({ success: true, created, updated });
  });
  app.post("/api/upload/pdf", async (c) => {
    const { inspectionId } = await c.req.json();
    if (!inspectionId) return c.json({ error: "inspectionId required" }, 400);
    const userId = edgespark.auth.user.id;
    const path = `reports/${userId}/${inspectionId}.pdf`;
    const { uploadUrl, expiresAt } = await edgespark.storage.from(storage_schema_exports.meinspect_reports).createPresignedPutUrl(path, 3600);
    await edgespark.db.update(db_schema_exports.inspections).set({ pdfUrl: path, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }).where(eq(db_schema_exports.inspections.id, inspectionId));
    return c.json({ uploadUrl, path, expiresAt });
  });
  app.get("/api/download/pdf/:inspectionId", async (c) => {
    const inspectionId = c.req.param("inspectionId");
    const inspection = await edgespark.db.select().from(db_schema_exports.inspections).where(eq(db_schema_exports.inspections.id, inspectionId));
    if (inspection.length === 0) return c.json({ error: "Not found" }, 404);
    const path = inspection[0].pdfUrl;
    if (!path) return c.json({ error: "PDF not available for this inspection" }, 404);
    const { downloadUrl, expiresAt } = await edgespark.storage.from(storage_schema_exports.meinspect_reports).createPresignedGetUrl(path, 3600);
    return c.json({ downloadUrl, expiresAt });
  });
  app.post("/api/upload/photo", async (c) => {
    const { inspectionId, photoId, contentType } = await c.req.json();
    if (!inspectionId || !photoId) return c.json({ error: "inspectionId and photoId required" }, 400);
    const userId = edgespark.auth.user.id;
    const ext = (contentType || "image/jpeg").includes("png") ? "png" : "jpg";
    const path = `photos/${userId}/${inspectionId}/${photoId}.${ext}`;
    const { uploadUrl, expiresAt } = await edgespark.storage.from(storage_schema_exports.meinspect_reports).createPresignedPutUrl(path, 3600);
    return c.json({ uploadUrl, path, expiresAt });
  });
  app.get("/api/download/photo", async (c) => {
    const path = c.req.query("path");
    if (!path) return c.json({ error: "path query param required" }, 400);
    const { downloadUrl, expiresAt } = await edgespark.storage.from(storage_schema_exports.meinspect_reports).createPresignedGetUrl(path, 3600);
    return c.json({ downloadUrl, expiresAt });
  });
  app.post("/api/download/photos", async (c) => {
    const { paths } = await c.req.json();
    if (!Array.isArray(paths)) return c.json({ error: "paths array required" }, 400);
    const urls = await Promise.all(
      paths.map(async (path) => {
        try {
          const { downloadUrl, expiresAt } = await edgespark.storage.from(storage_schema_exports.meinspect_reports).createPresignedGetUrl(path, 3600);
          return { path, downloadUrl, expiresAt, ok: true };
        } catch {
          return { path, ok: false };
        }
      })
    );
    return c.json({ urls });
  });
  app.post("/api/public/checkout", async (c) => {
    const { amount, currency = "AED", userId = "guest", inspectionId, discountCode, discountAmount } = await c.req.json();
    const sessionId = `cs_test_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const order = await edgespark.db.insert(db_schema_exports.orders).values({
      environment: getEnv(),
      userId,
      inspectionId: inspectionId || null,
      amount: amount || 500,
      currency,
      status: "pending",
      type: "one_time",
      provider: "dummy",
      providerSessionId: sessionId,
      discountCode: discountCode || null,
      discountAmount: discountAmount || 0
    }).returning();
    await edgespark.db.update(db_schema_exports.orders).set({ status: "paid", paidAt: Math.floor(Date.now() / 1e3) }).where(eq(db_schema_exports.orders.id, order[0].id));
    return c.json({
      success: true,
      sessionId,
      orderId: order[0].id,
      status: "paid",
      message: "Dummy payment processed successfully"
    });
  });
  app.get("/api/public/checkout/:sessionId", async (c) => {
    const sessionId = c.req.param("sessionId");
    const result = await edgespark.db.select().from(db_schema_exports.orders).where(eq(db_schema_exports.orders.providerSessionId, sessionId));
    if (result.length === 0) return c.json({ error: "Session not found" }, 404);
    return c.json({ data: result[0] });
  });
  app.get("/api/orders", async (c) => {
    const userId = edgespark.auth.user.id;
    const orders2 = await edgespark.db.select().from(db_schema_exports.orders).where(eq(db_schema_exports.orders.userId, userId));
    return c.json({ data: orders2 });
  });
  app.post("/api/admin/prices", async (c) => {
    const { name, amount, currency = "AED", type = "one_time" } = await c.req.json();
    const env = getEnv();
    const row = await edgespark.db.insert(db_schema_exports.paymentPrices).values({
      environment: env,
      name,
      amount,
      currency,
      type,
      provider: PROVIDER
    }).returning();
    return c.json({ data: row[0] }, 201);
  });
  app.get("/api/admin/prices", async (c) => {
    const env = getEnv();
    const prices = await edgespark.db.select().from(db_schema_exports.paymentPrices).where(eq(db_schema_exports.paymentPrices.environment, env));
    return c.json({ data: prices });
  });
  return app;
}
export {
  storage_schema_exports as buckets,
  createApp,
  drizzleSchema,
  db_schema_exports as tables
};
