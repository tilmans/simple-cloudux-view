const serviceRoots =
    "/apis/avid.ctms.registry;version=0;realm=global/serviceroots"

export const avid = [
    {
        name: "simple-app",
        provides: ["apps"],
        create: () => {
            return {
                config: {
                    menuName: "simple-app",
                    singleton: false,
                    useLegacyStyles: false,
                    icon: ""
                },
                factory: () => {
                    return new EntryApp()
                },
                _proto: null
            }
        }
    },
    {
        name: `simple-view`,
        provides: ["views"],
        create: () => {
            return {
                config: {
                    menuName: "simple-app",
                    singleton: false,
                    useLegacyStyles: false,
                    icon: ""
                },

                factory: () => {
                    return new ViewWrapper()
                },

                _proto: new ViewWrapper()
            }
        }
    }
]

class EntryApp {
    constructor() {
        this.viewName = "simple-view"
        this.state = {}
    }

    getLayoutConfig() {
        return {
            type: this.viewName,
            state: this.state
        }
    }

    onInit({ dispatch }) {
        this.dispatch = dispatch
    }

    onRender(headerContentEl, views) {
        this.innerView = { view: views[this.viewName] }
        this.headerContentEl = headerContentEl
    }

    onShow() {
        log("[ExamplePlugin] onShow")
    }

    onClose() {
        return Promise.resolve()
    }

    onHide() {
        log("[ExamplePlugin] onHide")
    }

    onUnrender() {
        log("[ExamplePlugin] onUnrender")
    }

    onBeforeUnrender() {
        log("[ExamplePlugin] onBeforeUnrender")
    }

    onDestroy() {
        log("[ExamplePlugin] onDestroy")
    }

    setContext(context) {
        log("[ExamplePlugin] context", context)
        this.innerView.view.setSelection(context)
    }

    get publicScope() {
        return {}
    }
}

class ViewWrapper {
    createElement() {
        const ui = `
            <div style="display: flex;flex-direction: column;width: 100%;height: 100%;">
                <div style="display: flex;">
                    <div style="flex-grow: 2;">
                        <input id="url_input"  type="text" size="80" 
                            style="width: 100%;height: 30px;border: 0;padding-left: 5px;color: black;">
                    </div>
                    <div><button type="button" id="submit_url" style="border: 0;height: 30px;">GET</button></div>
                </div>
                <div style="display: flex;height: 100%;">
                    <div id="request_log" style="display: flex;flex-direction: column;width: 200px;">
                    </div>
                    <div style="flex-grow: 2; height: 100%; overflow: scroll;" id="json_result">
                    </div>
                    <div id="asset_data" style="flex-grow: 1;"></div>
                </div>
            </div>
        `
        this.el = $(ui)
        this.el.on("drop", this.ondrop)
        return Promise.resolve(this.el[0])
    }

    onInit() {}

    ondrop(event) {
        event.preventDefault()
        event = event.originalEvent
        log("Drop Event", event)

        if (!event.dataTransfer) {
            log("No event.dataTransfer")
            return
        }

        const typesSet = new Set(event.dataTransfer.types)
        let assetInfo = ""

        if (typesSet.has("text/x.avid.asset-list")) {
            // http://developer.avid.com/mcux_ui_plugin/clux-api/context.html
            const data = event.dataTransfer.getData(
                "text/x.avid.asset-list+json"
            )
            getAsset(data).then(asset => {
                log("Asset", asset)
                getAssetData(asset.systemID, asset.id).then(data =>
                    log("AssetData", data)
                )
            })
        }
    }
    onRender() {
        // this.el.appendChild(this.pane.returnElement());
        $("#submit_url").on("click", ev => {
            let url = $("#url_input").val()
            fetch(url).then(data => {
                data.json().then(json => {
                    let output = $("#json_result")
                    output.html("")
                    output.append(
                        $(
                            `<pre class="prettyprint">${JSON.stringify(
                                json,
                                null,
                                2
                            )}</pre>`
                        )
                    )
                })
            })
        })
    }

    onDestroy(data) {}

    onRevalidate(data) {}

    onFocusLost() {}

    onFocusGained(event) {}

    enqueueLoading(promise) {}

    name(newName) {
        return ""
    }

    isShown() {
        return true
    }

    isVisible() {
        return true
    }

    closeAllowed() {
        return true
    }

    destroy() {}

    getMinHeight() {
        return 50
    }

    getMinWidth() {
        return 50
    }

    setSelection(context) {
        log("Set selection", context)
        if (context["text/x.avid.asset-list+json"]) {
            getAsset(context["text/x.avid.asset-list+json"]).then(asset => {
                log("Clicked on asset", asset)
                renderAsset(asset)
            })
        }
    }

    get publicScope() {
        return { setSelection: this.setSelection }
    }
}

function propSetReducer(acc, [key, value]) {
    return (acc += `<div>${key}: ${value}</div>`)
}

function renderAsset(asset) {
    const baseProps = Object.entries(asset.base).reduce(propSetReducer, "")
    const commonProps = Object.entries(asset.common).reduce(propSetReducer, "")
    const ui = `
    <div>
        <h2>Base</h2>
        ${baseProps}
        <h2>Common</h2>
        ${commonProps}
    </div>
    `
    $("#asset_data").html(ui)
}

async function getAsset(data) {
    // http://developer.avid.com/mcux_ui_plugin/clux-api/context.html
    const assetInfo = JSON.parse(data)[0]
    const asset = await getAssetData(assetInfo.systemID, assetInfo.id)
    log("Data", asset)
    return asset
}

async function getAssetData(systemId, mobId) {
    // First you need to look what file systems are available
    let result = await fetch(serviceRoots)
    logRequest(serviceRoots)
    let roots = await result.json()
    log("Roots", roots)

    // For given system find method responsible for asset details
    const assetInfo = roots.resources["aa:asset-by-id"]
    let target

    assetInfo.forEach(asset => {
        // Find one matching our system
        const found = asset.systems.find(system => system.systemID === systemId)
        if (found) {
            target = asset
        }
    })

    let requestUrl = target.href

    requestUrl = requestUrl.replace("{id}", encodeURIComponent(mobId))
    logRequest(requestUrl)
    let assetResult = await fetch(requestUrl)
    let assetById = await assetResult.json()
    // let thumbURL = assetById.data._links["aa:thumb"].href
    // let thumbRequest = await fetch(thumbURL)
    // logRequest(thumbURL)
    // let thumbData = await fetch(thumbRequest.json())
    const resultObject = Object.assign(
        {},
        { base: assetById.base },
        { common: assetById.common }
        // { thumbnail: thumbData.data.thumbnail }
    )
    return Promise.resolve(resultObject)
}

function log(...items) {
    console.log("SIMPLE | ", items)
}

function logRequest(url) {
    let entry = $(
        `<div style="padding: 6px; background-color: #111; word-break: break-all; cursor: pointer;">${url}</div>`
    )
    entry.click(ev => {
        $("#json_result").html(`Loading ${url}`)
        $("#url_input").val(url)
        $("#submit_url").click()
    })
    $("#request_log").append(entry)
}
