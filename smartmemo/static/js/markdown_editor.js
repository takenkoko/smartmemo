const previewDiv = document.getElementById('preview');
const textarea = document.getElementById('memo-content');

if(!previewDiv || !textarea){
    console.warn("Markdown editor elements not found.");
}else{

    //textareaをCodeMirrorに変換
    const editor = CodeMirror.fromTextArea(textarea, {
        mode: 'markdown',
        lineNumbers: true,
        lineWrapping: true,
        theme:'monokai',
        indentUnit: 4,
        tabSize: 4,
        
        extraKeys:{
            "Tab":function(cm){
                cm.replaceSelection("    ", "end");//4スペースでインデント
                },
                "Enter":"newlineAndIndentContinueMarkdownList"}
            });


            //Pyodide Workerを作成
            let pyodideWorker = null;

            
            //現在実行中のPythonコードに関する情報
            let currentOutputDiv = null;
            let currentButton = null;
            let currentCode = null;
            let executionTimer = null;

            function createPyodideWorker(){
                
                pyodideWorker = new Worker('/static/js/pyodide_worker.js?v=2');

                console.log("Pyodide Worker created.");

                //Workerのエラーを受け取る
                pyodideWorker.addEventListener('error',function(event){
                    console.error("Pyodide Worker Error:",event.message);
                    console.error("Worker error filename:",event.filename);
                    console.error("Worker error line",event.lineno);

                });
                
                //Pyodide Workerからのメッセージを受け取る
                pyodideWorker.addEventListener('message',function(event){
                    
                    const { type, text, name, message, prompt } = event.data;

                    if(type === 'worker_started'){
                        console.log("Worker started successfully.");
                    }

                    if(type === 'worker_load_started'){
                        console.log("Pyodide Worker load started.");
                    }

                    //Smart Inputの登録完了を受け取った場合
                    if(type === 'smart_input_registered'){
                        console.log("Smart Input registered.");
                    }

                    //Pythonコードから入力要求を受け取った場合
                    if(type === 'input_request'){
                        console.log("Input request received:", prompt);

                        //入力待ちのためタイマー停止
                        clearTimeout(executionTimer);
                        executionTimer = null;

                        const inputDiv = document.createElement('div');
                        inputDiv.className = 'mt-2';
                        inputDiv.dataset.smartInput = 'true';
                        
                        const inputField = document.createElement('input');
                        inputField.type = 'text';
                        inputField.className = 'form-control';
                        inputField.placeholder = prompt;
                        
                        const submitButton = document.createElement('button');
                        submitButton.textContent = '入力';
                        submitButton.type = 'button';
                        submitButton.className = 'btn-primary mt-2';

                        //入力ボタンが押されたとき
                        submitButton.addEventListener('click',function(){

                            const userInput = inputField.value;

                            console.log("User Input:", userInput);

                            //入力値をWorkerへ送信
                            pyodideWorker.postMessage({
                                type:'input',
                                userInput: userInput
                            });
                        });
                        
                        inputDiv.appendChild(inputField);
                        inputDiv.appendChild(submitButton);


                        currentOutputDiv.appendChild(inputDiv);

                        inputDiv.style.display = 'block';
                        inputDiv.style.visibility = 'visible';


                    }

                    
                    if (!currentOutputDiv){
                        return;
                    }
                    
                    //Pythonのprint()出力
                    if(type === 'stdout'){


                        const outputTextDiv = currentOutputDiv.querySelector('[data-smart-output-text]');
                        
    
                        if(outputTextDiv){
                            outputTextDiv.textContent += text + "\n";
                        }

                    }
                    
                    //Pythonの実行完了
                    if(type === 'done'){

                        //入力UIを除外して実行結果だけ取得する
                        const inputDiv = currentOutputDiv.querySelector('[data-smart-input]');


                        if(inputDiv){
                            inputDiv.remove();
                        }

                        //実行結果だけ取得する
                        const outputTextDiv = currentOutputDiv.querySelector('[data-smart-output-text]');

                        const executionOutput = outputTextDiv ? outputTextDiv.textContent : '';

                        console.log("Execution Output:",executionOutput);
                        
                        updateOutputBlock(
                        editor,
                        currentCode,
                        executionOutput
                    );
                    
                    const hiddenOutput = document.getElementById("execution-output");
                    
                    if(hiddenOutput){
                        hiddenOutput.value = executionOutput;
                    }

                    if(currentButton){
                        currentButton.disabled = false;
                        currentButton.textContent = '▶ Run';
                    }

                    currentOutputDiv = null;
                    currentButton = null;
                    currentCode = null;
                }

                //Pythonエラー 
                if(type === 'error'){
                    currentOutputDiv.classList.remove('text-light');
                    currentOutputDiv.classList.add('text-danger');
                    
                    
                    currentOutputDiv.textContent = 
                    `❌ ${name || 'Error'}: ${message}\n`;

                    updateOutputBlock(
                        editor,
                        currentCode,
                        currentOutputDiv.textContent,
                        true
                    );

                    const hiddenOutput = document.getElementById("execution-output");

                    if(hiddenOutput){
                        hiddenOutput.value = currentOutputDiv.textContent;
                    }

                    if(currentButton){
                        currentButton.disabled = false;
                        currentButton.textContent = '▶ Run';
                    }

                    currentOutputDiv = null;
                    currentButton = null;
                    currentCode = null;
                }
                });

            
            }
            //最初のWorkerを作成
            createPyodideWorker();
           
            //コードブロック実行ボタンを追加する
            function attachRunButtons(container){
                const codeBlocks = container.querySelectorAll('pre code');
                
                codeBlocks.forEach(function(block){
                    if(block.dataset.runAttached)return;
                    block.dataset.runAttached = "true";
                    
                    const isPython = block.className.includes('language-python') || block.className.includes('python');
                    
                    if (!isPython) return;
                    
                    const button = document.createElement('button');
                    button.textContent = '▶ Run';
                    button.type = 'button';
                    button.className = 'btn btn-sm btn-success mb-2';

                    
                    const outputDiv = document.createElement('div');

                    const outputTextDiv = document.createElement('div');
                    outputTextDiv.dataset.smartOutputText = 'true';

                    outputDiv.appendChild(outputTextDiv);

                    outputDiv.className = 'mt-2 p-2 bg-dark text-light rounded';
                    outputDiv.style.fontFamily = 'monospace';
                    outputDiv.style.whiteSpace = 'pre-wrap';
                    outputDiv.style.display = 'none';

                    //実行結果
                    outputDiv.dataset.smartOutput ='true';
                    
                    button.addEventListener('click',async function(){

                        //Stopボタンとして動作するようにする
                        if(button.textContent === '■ Stop'){

                            
                            //Workerを停止
                            pyodideWorker.terminate();
                            

                            //SmartInputを削除
                            const inputDiv = outputDiv.querySelector('[data-smart-input]');


                            if(inputDiv){
                                inputDiv.remove();
                                
                            }
                            
                            //新しいWorkerを作成
                            createPyodideWorker();
                            
                            //実行状態をリセット
                            currentOutputDiv = null;
                            currentButton = null;
                            currentCode = null;

                            button.textContent = '▶ Run';

                            return;
                        }

                        button.disabled = false;
                        button.textContent = '■ Stop';
                        
                        
                        outputDiv.style.display = 'block';
                        
                        const outputTextDiv = outputDiv.querySelector('[data-smart-output-text]');

                        if(outputTextDiv){
                            outputTextDiv.textContent = '';
                        }

                        
                        outputDiv.classList.remove('text-danger');
                        outputDiv.classList.add('text-light');
                        
                      
                        //Pythonコードを取得
                        const code = block.textContent;

                        //現在のコードブロックの情報を保存
                        currentOutputDiv = outputDiv;
                        currentButton = button;
                        currentCode = code;

                        //PythonコードをWorkerへ送信
                        console.log("Sending run message to Worker.");

                        pyodideWorker.postMessage({
                            type:'run',
                            code:code
                        });
                        
                        //タイムアウトタイマーを開始
                        console.log("Timeout Timer Started.");

                        executionTimer = setTimeout(function(){

                            console.log("Python execution timed out.");

                            //Workerを停止
                            pyodideWorker.terminate();
                            //新しいWorkerを作成
                            createPyodideWorker();

                            //タイムアウトメッセージを表示
                            if(currentOutputDiv){
                                currentOutputDiv.classList.remove('text-light');
                                currentOutputDiv.classList.add('text-danger');
                                currentOutputDiv.textContent = '❌ Timeout:実行時間が10秒を超えたため停止しました。\n';
                            }
                            if(currentButton){
                                currentButton.disabled = false;
                                currentButton.textContent = '▶ Run';
                            }
                            //実行状態をリセット
                            currentOutputDiv = null;
                            currentButton = null;
                            currentCode = null; 

                        }, 10000); //10秒のタイムアウト


                        //フォーム送信用に、画面に表示された実行結果を hidden input (execution-output) にセット
                        const hiddenOutput = document.getElementById("execution-output");
                        if(hiddenOutput){
                            hiddenOutput.value = outputDiv.textContent;
                        }

                    });
                    block.parentNode.insertAdjacentElement('afterend',button);
                    button.insertAdjacentElement('afterend',outputDiv);
                });
            }

            //コードブロックごとに実行管理
            function updateOutputBlock(editor,code,output,isError){
                
                //エディタ全体のMarkdownを取得
                const currentContent = editor.getValue();

                //実行したPyhtonコードブロックを作成
                const codeBlock = 
                "```python\n" + 
                code.trim() + 
                "\n```";

                const fenceLabel = isError ? 'error' : 'text';

                //実行結果ブロックを作成
                const outputBlock = 
                "\n\n```" + fenceLabel + "\n" + 
                output.trim() +
                "\n```\n";

                //実行したコードブロックの位置を検索
                const position = currentContent.indexOf(codeBlock);

                //コードが見つからなければ終了
                if (position === -1){
                    return;
                }

                //コードブロックまで内容を取得
                const before = currentContent.slice(
                    0,
                    position + codeBlock.length
                );

                // コードブロック以降の内容を取得
                let after = currentContent.slice(
                    position + codeBlock.length
                    
                );

                //既存の実行結果(textブロック)を削除
                after = after.replace(
                        /^\s*```(?:text|error)[\s\S]*?```\s*/,
                        ""
                    );

                //新しい実行結果を導入    
                const newContent = 
                before + 
                outputBlock + 
                after;
                
                //エディタを更新
                editor.setValue(newContent);

            }

            function renderMarkdown(){
                const rawHTML = marked.parse(editor.getValue());
                previewDiv.innerHTML = DOMPurify.sanitize(rawHTML);
            }
                
            //数式のレンダリング
            function renderMath(){
                renderMathInElement(previewDiv, {
                    delimiters: [
                        {left: "$$", right: "$$", display: true},
                        {left: "$", right: "$", display: false}
                    ],
                });
            }

            function renderCodeBlocks(){
                attachRunButtons(previewDiv);//コードブロックに実行ボタンを追加
            }

            //入力のたびにプレイヤーを更新
            function updatePreview(){
                renderMarkdown();
                renderMath();
                renderCodeBlocks();
            }

            //フォーム送信前に、Codemirrorの内容をtextareaに反映

            editor.on('change',updatePreview);

            updatePreview();
            
            const form = document.querySelector('form');
            form.addEventListener('submit', ()=>{
                editor.save(); 
            
            });


            //Editor / Preview の幅を変更
            const resizeHandle = document.querySelector('.resize-handle');
            const editorSection = document.querySelector('.editor-section');
            const previewSection = document.querySelector('.preview-section');

            let isResizing = false;

            resizeHandle.addEventListener('mousedown',function(){
                isResizing = true;
                document.body.style.cursor = 'col-resize';
            });

            document.addEventListener('mousemove',function(event){
                if(!isResizing)return;

                const container = document.querySelector('.editor-preview-container');
                const rect = container.getBoundingClientRect();

                const width = event.clientX - rect.left;
                let percentage = (width / rect.width) * 100;

                //Editor / Preview の最小・最大幅を設定
                const minWidth = 25;
                const maxWidth = 75;

                percentage = Math.max(minWidth, Math.min(maxWidth,percentage));
                
                editorSection.style.flex =`0 0 ${percentage}%`;
                previewSection.style.flex = '1';
            });

            document.addEventListener('mouseup',function(){
                if(!isResizing)return;

                isResizing = false;
                document.body.style.cursor = '';
            });
            
    
}

