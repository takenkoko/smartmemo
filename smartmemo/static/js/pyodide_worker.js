//PyodideをWorker内で読み込む
importScripts("https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js");

let pyodide = null;

//pyodideの読み込み
async function loadPyodideWorker(){
    if(!pyodide){
        pyodide = await loadPyodide({
            indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/"
        });
    }

    return pyodide;
}

//メインスレッドからのメッセージを受け取る
self.addEventListener("message",async function(event) {

    const{ type,code} = event.data;

    if(type !== "run"){
        return;
    }

    try{
        const pyodide = await loadPyodideWorker();

        //Pythonのprint()を取得
        pyodide.setStdout({
            batched: (text) => {
                self.postMessage({ type: "stdout", text });
            }
        });

        //Pythonコードを実行
        await pyodide.runPythonAsync(code);

        //実行完了
        self.postMessage({ type: "done" });
    } catch(error){
        //エラーを送信
        self.postMessage({ type: "error",
            name: error.name || "Error",
            message: error.message || String(error)
        });
    }
});