//PyodideをWorker内で読み込む
importScripts("https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js");

self.postMessage({
    type:"worker_started"
});

let pyodide = null;

//Pythonからの入力を持っている状態
let inputResolver = null;

//Pythonからの入力を待っている状態
async function smartInput(prompt){

    //メインスレッドに入力を要求
    self.postMessage({ type: "input_request", prompt: prompt });

    //ユーザーの入力を待つ
    return new Promise(function(resolve){
        inputResolver = resolve;
    });
}

//pyodideの読み込み
async function loadPyodideWorker(){
   
    self.postMessage({type: "worker_load_started"});

    if(!pyodide){
        pyodide = await loadPyodide({
            indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/"
        });

        //Pythonからsmart_input()を呼び出せるようにする
        pyodide.globals.set("smart_input", smartInput);
        self.postMessage({ type: "smart_input_registered" });

    }

    return pyodide;
}

//メインスレッドからのメッセージを受け取る
self.addEventListener("message",async function(event) {

    const{ type,code,userInput } = event.data;

    self.postMessage({ type:"worker_message_received"});

    //入力値を受け取った場合
    if(type === "input"){
        console.log("Received user input:", event.data.userInput);

        if(inputResolver){
            inputResolver(userInput);
            inputResolver = null;
        }

        return;
    }

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