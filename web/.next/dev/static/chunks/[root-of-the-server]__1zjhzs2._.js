(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/node_modules/@ffmpeg/ffmpeg/dist/esm/classes.js [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "FFmpeg",
    ()=>FFmpeg
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$ffmpeg$2f$ffmpeg$2f$dist$2f$esm$2f$const$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@ffmpeg/ffmpeg/dist/esm/const.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$ffmpeg$2f$ffmpeg$2f$dist$2f$esm$2f$utils$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@ffmpeg/ffmpeg/dist/esm/utils.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$ffmpeg$2f$ffmpeg$2f$dist$2f$esm$2f$errors$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@ffmpeg/ffmpeg/dist/esm/errors.js [app-client] (ecmascript)");
var __TURBOPACK__import$2e$meta__ = {
    get url () {
        return __turbopack_context__.F("node_modules/@ffmpeg/ffmpeg/dist/esm/classes.js");
    },
    env: {
        DEV: true,
        PROD: false,
        MODE: "development",
        BASE_URL: "/",
        SSR: false
    },
    get turbopackHot () {
        return __turbopack_context__.m.hot;
    }
};
;
;
;
class FFmpeg {
    #worker = null;
    /**
     * #resolves and #rejects tracks Promise resolves and rejects to
     * be called when we receive message from web worker.
     */ #resolves = {};
    #rejects = {};
    #logEventCallbacks = [];
    #progressEventCallbacks = [];
    loaded = false;
    /**
     * register worker message event handlers.
     */ #registerHandlers = ()=>{
        if (this.#worker) {
            this.#worker.onmessage = ({ data: { id, type, data } })=>{
                switch(type){
                    case __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$ffmpeg$2f$ffmpeg$2f$dist$2f$esm$2f$const$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FFMessageType"].LOAD:
                        this.loaded = true;
                        this.#resolves[id](data);
                        break;
                    case __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$ffmpeg$2f$ffmpeg$2f$dist$2f$esm$2f$const$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FFMessageType"].MOUNT:
                    case __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$ffmpeg$2f$ffmpeg$2f$dist$2f$esm$2f$const$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FFMessageType"].UNMOUNT:
                    case __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$ffmpeg$2f$ffmpeg$2f$dist$2f$esm$2f$const$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FFMessageType"].EXEC:
                    case __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$ffmpeg$2f$ffmpeg$2f$dist$2f$esm$2f$const$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FFMessageType"].FFPROBE:
                    case __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$ffmpeg$2f$ffmpeg$2f$dist$2f$esm$2f$const$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FFMessageType"].WRITE_FILE:
                    case __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$ffmpeg$2f$ffmpeg$2f$dist$2f$esm$2f$const$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FFMessageType"].READ_FILE:
                    case __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$ffmpeg$2f$ffmpeg$2f$dist$2f$esm$2f$const$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FFMessageType"].DELETE_FILE:
                    case __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$ffmpeg$2f$ffmpeg$2f$dist$2f$esm$2f$const$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FFMessageType"].RENAME:
                    case __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$ffmpeg$2f$ffmpeg$2f$dist$2f$esm$2f$const$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FFMessageType"].CREATE_DIR:
                    case __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$ffmpeg$2f$ffmpeg$2f$dist$2f$esm$2f$const$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FFMessageType"].LIST_DIR:
                    case __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$ffmpeg$2f$ffmpeg$2f$dist$2f$esm$2f$const$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FFMessageType"].DELETE_DIR:
                        this.#resolves[id](data);
                        break;
                    case __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$ffmpeg$2f$ffmpeg$2f$dist$2f$esm$2f$const$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FFMessageType"].LOG:
                        this.#logEventCallbacks.forEach((f)=>f(data));
                        break;
                    case __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$ffmpeg$2f$ffmpeg$2f$dist$2f$esm$2f$const$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FFMessageType"].PROGRESS:
                        this.#progressEventCallbacks.forEach((f)=>f(data));
                        break;
                    case __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$ffmpeg$2f$ffmpeg$2f$dist$2f$esm$2f$const$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FFMessageType"].ERROR:
                        this.#rejects[id](data);
                        break;
                }
                delete this.#resolves[id];
                delete this.#rejects[id];
            };
        }
    };
    /**
     * Generic function to send messages to web worker.
     */ #send = ({ type, data }, trans = [], signal)=>{
        if (!this.#worker) {
            return Promise.reject(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$ffmpeg$2f$ffmpeg$2f$dist$2f$esm$2f$errors$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ERROR_NOT_LOADED"]);
        }
        return new Promise((resolve, reject)=>{
            const id = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$ffmpeg$2f$ffmpeg$2f$dist$2f$esm$2f$utils$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getMessageID"])();
            this.#worker && this.#worker.postMessage({
                id,
                type,
                data
            }, trans);
            this.#resolves[id] = resolve;
            this.#rejects[id] = reject;
            signal?.addEventListener("abort", ()=>{
                reject(new DOMException(`Message # ${id} was aborted`, "AbortError"));
            }, {
                once: true
            });
        });
    };
    on(event, callback) {
        if (event === "log") {
            this.#logEventCallbacks.push(callback);
        } else if (event === "progress") {
            this.#progressEventCallbacks.push(callback);
        }
    }
    off(event, callback) {
        if (event === "log") {
            this.#logEventCallbacks = this.#logEventCallbacks.filter((f)=>f !== callback);
        } else if (event === "progress") {
            this.#progressEventCallbacks = this.#progressEventCallbacks.filter((f)=>f !== callback);
        }
    }
    /**
     * Loads ffmpeg-core inside web worker. It is required to call this method first
     * as it initializes WebAssembly and other essential variables.
     *
     * @category FFmpeg
     * @returns `true` if ffmpeg core is loaded for the first time.
     */ load = ({ classWorkerURL, ...config } = {}, { signal } = {})=>{
        if (!this.#worker) {
            this.#worker = classWorkerURL ? new Worker(new URL(classWorkerURL, __TURBOPACK__import$2e$meta__.url), {
                type: "module"
            }) : // We need to duplicated the code here to enable webpack
            // to bundle worekr.js here.
            __turbopack_context__.r("[project]/node_modules/@ffmpeg/ffmpeg/dist/esm/worker.js [app-client] (ecmascript, worker loader)")(Worker, {
                type: "module"
            });
            this.#registerHandlers();
        }
        return this.#send({
            type: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$ffmpeg$2f$ffmpeg$2f$dist$2f$esm$2f$const$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FFMessageType"].LOAD,
            data: config
        }, undefined, signal);
    };
    /**
     * Execute ffmpeg command.
     *
     * @remarks
     * To avoid common I/O issues, ["-nostdin", "-y"] are prepended to the args
     * by default.
     *
     * @example
     * ```ts
     * const ffmpeg = new FFmpeg();
     * await ffmpeg.load();
     * await ffmpeg.writeFile("video.avi", ...);
     * // ffmpeg -i video.avi video.mp4
     * await ffmpeg.exec(["-i", "video.avi", "video.mp4"]);
     * const data = ffmpeg.readFile("video.mp4");
     * ```
     *
     * @returns `0` if no error, `!= 0` if timeout (1) or error.
     * @category FFmpeg
     */ exec = (/** ffmpeg command line args */ args, /**
     * milliseconds to wait before stopping the command execution.
     *
     * @defaultValue -1
     */ timeout = -1, { signal } = {})=>this.#send({
            type: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$ffmpeg$2f$ffmpeg$2f$dist$2f$esm$2f$const$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FFMessageType"].EXEC,
            data: {
                args,
                timeout
            }
        }, undefined, signal);
    /**
     * Execute ffprobe command.
     *
     * @example
     * ```ts
     * const ffmpeg = new FFmpeg();
     * await ffmpeg.load();
     * await ffmpeg.writeFile("video.avi", ...);
     * // Getting duration of a video in seconds: ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 video.avi -o output.txt
     * await ffmpeg.ffprobe(["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", "video.avi", "-o", "output.txt"]);
     * const data = ffmpeg.readFile("output.txt");
     * ```
     *
     * @returns `0` if no error, `!= 0` if timeout (1) or error.
     * @category FFmpeg
     */ ffprobe = (/** ffprobe command line args */ args, /**
     * milliseconds to wait before stopping the command execution.
     *
     * @defaultValue -1
     */ timeout = -1, { signal } = {})=>this.#send({
            type: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$ffmpeg$2f$ffmpeg$2f$dist$2f$esm$2f$const$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FFMessageType"].FFPROBE,
            data: {
                args,
                timeout
            }
        }, undefined, signal);
    /**
     * Terminate all ongoing API calls and terminate web worker.
     * `FFmpeg.load()` must be called again before calling any other APIs.
     *
     * @category FFmpeg
     */ terminate = ()=>{
        const ids = Object.keys(this.#rejects);
        // rejects all incomplete Promises.
        for (const id of ids){
            this.#rejects[id](__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$ffmpeg$2f$ffmpeg$2f$dist$2f$esm$2f$errors$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ERROR_TERMINATED"]);
            delete this.#rejects[id];
            delete this.#resolves[id];
        }
        if (this.#worker) {
            this.#worker.terminate();
            this.#worker = null;
            this.loaded = false;
        }
    };
    /**
     * Write data to ffmpeg.wasm.
     *
     * @example
     * ```ts
     * const ffmpeg = new FFmpeg();
     * await ffmpeg.load();
     * await ffmpeg.writeFile("video.avi", await fetchFile("../video.avi"));
     * await ffmpeg.writeFile("text.txt", "hello world");
     * ```
     *
     * @category File System
     */ writeFile = (path, data, { signal } = {})=>{
        const trans = [];
        if (data instanceof Uint8Array) {
            trans.push(data.buffer);
        }
        return this.#send({
            type: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$ffmpeg$2f$ffmpeg$2f$dist$2f$esm$2f$const$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FFMessageType"].WRITE_FILE,
            data: {
                path,
                data
            }
        }, trans, signal);
    };
    mount = (fsType, options, mountPoint)=>{
        const trans = [];
        return this.#send({
            type: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$ffmpeg$2f$ffmpeg$2f$dist$2f$esm$2f$const$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FFMessageType"].MOUNT,
            data: {
                fsType,
                options,
                mountPoint
            }
        }, trans);
    };
    unmount = (mountPoint)=>{
        const trans = [];
        return this.#send({
            type: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$ffmpeg$2f$ffmpeg$2f$dist$2f$esm$2f$const$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FFMessageType"].UNMOUNT,
            data: {
                mountPoint
            }
        }, trans);
    };
    /**
     * Read data from ffmpeg.wasm.
     *
     * @example
     * ```ts
     * const ffmpeg = new FFmpeg();
     * await ffmpeg.load();
     * const data = await ffmpeg.readFile("video.mp4");
     * ```
     *
     * @category File System
     */ readFile = (path, /**
     * File content encoding, supports two encodings:
     * - utf8: read file as text file, return data in string type.
     * - binary: read file as binary file, return data in Uint8Array type.
     *
     * @defaultValue binary
     */ encoding = "binary", { signal } = {})=>this.#send({
            type: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$ffmpeg$2f$ffmpeg$2f$dist$2f$esm$2f$const$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FFMessageType"].READ_FILE,
            data: {
                path,
                encoding
            }
        }, undefined, signal);
    /**
     * Delete a file.
     *
     * @category File System
     */ deleteFile = (path, { signal } = {})=>this.#send({
            type: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$ffmpeg$2f$ffmpeg$2f$dist$2f$esm$2f$const$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FFMessageType"].DELETE_FILE,
            data: {
                path
            }
        }, undefined, signal);
    /**
     * Rename a file or directory.
     *
     * @category File System
     */ rename = (oldPath, newPath, { signal } = {})=>this.#send({
            type: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$ffmpeg$2f$ffmpeg$2f$dist$2f$esm$2f$const$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FFMessageType"].RENAME,
            data: {
                oldPath,
                newPath
            }
        }, undefined, signal);
    /**
     * Create a directory.
     *
     * @category File System
     */ createDir = (path, { signal } = {})=>this.#send({
            type: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$ffmpeg$2f$ffmpeg$2f$dist$2f$esm$2f$const$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FFMessageType"].CREATE_DIR,
            data: {
                path
            }
        }, undefined, signal);
    /**
     * List directory contents.
     *
     * @category File System
     */ listDir = (path, { signal } = {})=>this.#send({
            type: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$ffmpeg$2f$ffmpeg$2f$dist$2f$esm$2f$const$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FFMessageType"].LIST_DIR,
            data: {
                path
            }
        }, undefined, signal);
    /**
     * Delete an empty directory.
     *
     * @category File System
     */ deleteDir = (path, { signal } = {})=>this.#send({
            type: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$ffmpeg$2f$ffmpeg$2f$dist$2f$esm$2f$const$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FFMessageType"].DELETE_DIR,
            data: {
                path
            }
        }, undefined, signal);
}
}),
"[project]/node_modules/@ffmpeg/ffmpeg/dist/esm/const.js [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CORE_URL",
    ()=>CORE_URL,
    "CORE_VERSION",
    ()=>CORE_VERSION,
    "FFMessageType",
    ()=>FFMessageType,
    "MIME_TYPE_JAVASCRIPT",
    ()=>MIME_TYPE_JAVASCRIPT,
    "MIME_TYPE_WASM",
    ()=>MIME_TYPE_WASM
]);
const MIME_TYPE_JAVASCRIPT = "text/javascript";
const MIME_TYPE_WASM = "application/wasm";
const CORE_VERSION = "0.12.9";
const CORE_URL = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/umd/ffmpeg-core.js`;
var FFMessageType;
(function(FFMessageType) {
    FFMessageType["LOAD"] = "LOAD";
    FFMessageType["EXEC"] = "EXEC";
    FFMessageType["FFPROBE"] = "FFPROBE";
    FFMessageType["WRITE_FILE"] = "WRITE_FILE";
    FFMessageType["READ_FILE"] = "READ_FILE";
    FFMessageType["DELETE_FILE"] = "DELETE_FILE";
    FFMessageType["RENAME"] = "RENAME";
    FFMessageType["CREATE_DIR"] = "CREATE_DIR";
    FFMessageType["LIST_DIR"] = "LIST_DIR";
    FFMessageType["DELETE_DIR"] = "DELETE_DIR";
    FFMessageType["ERROR"] = "ERROR";
    FFMessageType["DOWNLOAD"] = "DOWNLOAD";
    FFMessageType["PROGRESS"] = "PROGRESS";
    FFMessageType["LOG"] = "LOG";
    FFMessageType["MOUNT"] = "MOUNT";
    FFMessageType["UNMOUNT"] = "UNMOUNT";
})(FFMessageType || (FFMessageType = {}));
}),
"[project]/node_modules/@ffmpeg/ffmpeg/dist/esm/errors.js [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ERROR_IMPORT_FAILURE",
    ()=>ERROR_IMPORT_FAILURE,
    "ERROR_NOT_LOADED",
    ()=>ERROR_NOT_LOADED,
    "ERROR_TERMINATED",
    ()=>ERROR_TERMINATED,
    "ERROR_UNKNOWN_MESSAGE_TYPE",
    ()=>ERROR_UNKNOWN_MESSAGE_TYPE
]);
const ERROR_UNKNOWN_MESSAGE_TYPE = new Error("unknown message type");
const ERROR_NOT_LOADED = new Error("ffmpeg is not loaded, call `await ffmpeg.load()` first");
const ERROR_TERMINATED = new Error("called FFmpeg.terminate()");
const ERROR_IMPORT_FAILURE = new Error("failed to import ffmpeg-core.js");
}),
"[project]/node_modules/@ffmpeg/ffmpeg/dist/esm/index.js [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "FFFSType",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$ffmpeg$2f$ffmpeg$2f$dist$2f$esm$2f$types$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FFFSType"],
    "FFmpeg",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$ffmpeg$2f$ffmpeg$2f$dist$2f$esm$2f$classes$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FFmpeg"]
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$ffmpeg$2f$ffmpeg$2f$dist$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@ffmpeg/ffmpeg/dist/esm/index.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$ffmpeg$2f$ffmpeg$2f$dist$2f$esm$2f$classes$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@ffmpeg/ffmpeg/dist/esm/classes.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$ffmpeg$2f$ffmpeg$2f$dist$2f$esm$2f$types$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@ffmpeg/ffmpeg/dist/esm/types.js [app-client] (ecmascript)");
}),
"[project]/node_modules/@ffmpeg/ffmpeg/dist/esm/index.js [app-client] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$ffmpeg$2f$ffmpeg$2f$dist$2f$esm$2f$classes$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@ffmpeg/ffmpeg/dist/esm/classes.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$ffmpeg$2f$ffmpeg$2f$dist$2f$esm$2f$types$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@ffmpeg/ffmpeg/dist/esm/types.js [app-client] (ecmascript)");
;
;
}),
"[project]/node_modules/@ffmpeg/ffmpeg/dist/esm/types.js [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "FFFSType",
    ()=>FFFSType
]);
var FFFSType;
(function(FFFSType) {
    FFFSType["MEMFS"] = "MEMFS";
    FFFSType["NODEFS"] = "NODEFS";
    FFFSType["NODERAWFS"] = "NODERAWFS";
    FFFSType["IDBFS"] = "IDBFS";
    FFFSType["WORKERFS"] = "WORKERFS";
    FFFSType["PROXYFS"] = "PROXYFS";
})(FFFSType || (FFFSType = {}));
}),
"[project]/node_modules/@ffmpeg/ffmpeg/dist/esm/utils.js [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Generate an unique message ID.
 */ __turbopack_context__.s([
    "getMessageID",
    ()=>getMessageID
]);
const getMessageID = (()=>{
    let messageID = 0;
    return ()=>messageID++;
})();
}),
"[project]/node_modules/@ffmpeg/ffmpeg/dist/esm/worker.js (static in ecmascript, tag client)", ((__turbopack_context__) => {

__turbopack_context__.q("/_next/static/media/worker.35blsg0sxlqn3.js");}),
"[project]/node_modules/@ffmpeg/ffmpeg/dist/esm/worker.js [app-client] (ecmascript, worker loader)", ((__turbopack_context__) => {

__turbopack_context__.v(__turbopack_context__.r("[turbopack-ecmascript]/worker/browser/createWorker.ts [app-client] (ecmascript)")["default"]("static/chunks/turbopack-worker-[client-fs]__next_static_chunks_1_hyozq._.js", ["static/chunks/node_modules_@ffmpeg_ffmpeg_dist_esm_0c29sfw._.js","static/chunks/node_modules_@ffmpeg_ffmpeg_dist_esm_worker_1gdnjqz.js","static/chunks/turbopack-node_modules_@ffmpeg_ffmpeg_dist_esm_worker_0f14788.js"]));
}),
"[turbopack-ecmascript]/worker/browser/createWorker.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Embedded worker-runtime helper. This file is bundled as a regular module and
// `__turbopack_require__`d by the generated web-worker loader code.
//
// The chunk-URL builder, the chunk base path and the asset suffix are read from
// the shared `__turbopack_chunk_relative_url__` / `__turbopack_chunk_base_path__`
// / `__turbopack_chunk_asset_suffix__` runtime primitives. The worker base-path
// override and forwarded-global names are baked into this module at build time by
// `turbopack-ecmascript` replacing the `_TURBOPACK_WORKER_BASE_PATH_` /
// `_TURBOPACK_WORKER_FORWARDED_GLOBALS_` free variables, and the forwarded-global
// values are read from `globalThis`.
__turbopack_context__.s([
    "default",
    ()=>generateCreateWorker
]);
/**
 * Creates a web worker by instantiating the given WorkerConstructor with the
 * appropriate URL and options.
 *
 * The entrypoint is a pre-compiled worker runtime file. The params configure
 * which module chunks to load and which module to run as the entry point.
 *
 * The params are a JSON array of the following structure:
 * `[TURBOPACK_NEXT_CHUNK_URLS, ASSET_SUFFIX, ...workerForwardedGlobals values]`
 *
 * @param WorkerConstructor The Worker or SharedWorker constructor
 * @param entrypoint path to the worker entrypoint chunk
 * @param moduleChunks list of module chunk paths to load
 * @param workerOptions options to pass to the Worker constructor (optional)
 */ function createWorker(WorkerConstructor, entrypoint, moduleChunks, workerOptions) {
    const isSharedWorker = WorkerConstructor.name === 'SharedWorker';
    // `WORKER_BASE_PATH` overrides `CHUNK_BASE_PATH` for the entrypoint and the
    // module chunks loaded inside the worker, keeping them same-origin to each
    // other when `CHUNK_BASE_PATH` (= `assetPrefix`) is a cross-origin CDN.
    // `null` falls back; an empty string is treated as a literal empty prefix.
    const workerBasePath = null ?? /*TURBOPACK member replacement*/ __turbopack_context__.b;
    const chunkUrls = moduleChunks.map((chunk)=>/*TURBOPACK member replacement*/ __turbopack_context__.h(typeof chunk === 'string' ? chunk : chunk.path, workerBasePath)).reverse();
    const params = [
        chunkUrls,
        /*TURBOPACK member replacement*/ __turbopack_context__.X
    ];
    const globals = [
        "NEXT_DEPLOYMENT_ID",
        "NEXT_CLIENT_ASSET_SUFFIX"
    ];
    for(let i = 0; i < globals.length; i++){
        params.push(globalThis[globals[i]]);
    }
    const url = new URL(/*TURBOPACK member replacement*/ __turbopack_context__.h(entrypoint, workerBasePath), location.origin);
    const paramsJson = JSON.stringify(params);
    if (isSharedWorker) {
        url.searchParams.set('params', paramsJson);
    } else {
        url.hash = '#params=' + encodeURIComponent(paramsJson);
    }
    // Remove type: "module" from options since our worker entrypoint is not a module
    const options = workerOptions ? {
        ...workerOptions,
        type: undefined
    } : undefined;
    return new WorkerConstructor(url, options);
}
function generateCreateWorker(entrypoint, moduleChunks) {
    return (WorkerConstructor, workerOptions)=>createWorker(WorkerConstructor, entrypoint, moduleChunks, workerOptions);
}
}),
]);

//# sourceMappingURL=%5Broot-of-the-server%5D__1zjhzs2._.js.map