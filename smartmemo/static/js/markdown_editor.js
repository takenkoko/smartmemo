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
            
            function resizeEditor(){
                editor.setSize(
                '100%', 
                document.querySelector('#preview').clientHeight
            );//高さプレビュー欄を揃える

            }
            
            resizeEditor();
            
            //pyodideの読み込み
            let pyodideReadyPromise = null;
            async function getPyodide() {
                if (!pyodideReadyPromise) {
                    pyodideReadyPromise = loadPyodide();
                }
                return pyodideReadyPromise;
            }
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
                    outputDiv.className = 'mt-2 p-2 bg-dark text-light rounded';
                    outputDiv.style.fontFamily = 'monospace';
                    outputDiv.style.whiteSpace = 'pre-wrap';
                    outputDiv.style.display = 'none';
                    
                    button.addEventListener('click',async function(){
                        button.disabled = true;
                        button.textContent = 'Running...';
                        
                        const pyodide = await getPyodide();
                        outputDiv.style.display = 'block';
                        outputDiv.textContent = '';
                        outputDiv.classList.remove('text-danger');
                        outputDiv.classList.add('text-light');
                        
                        try{
                            pyodide.setStdout({
                                batched: (text) => {
                                    outputDiv.textContent += text + '\n';
                                }
                            });
                            await pyodide.runPythonAsync(block.textContent);

                            //updateOutputBlock()を呼び出す
                            updateOutputBlock(
                                editor,
                                block.textContent,
                                outputDiv.textContent
                            );
                        
                        }catch (err){
                            //エラー表示に×マークを追加
                            outputDiv.classList.remove('text-light');
                            outputDiv.classList.add('text-danger');

                            //エラー内容を表示
                            outputDiv.textContent = 
                            `❌ ${err.name ||'Error'}: ${err.message}\n`;

                            //エラー内容もMarkdownへ保存する
                            updateOutputBlock(
                                editor,
                                block.textContent,
                                outputDiv.textContent,
                                true
                            )
                        }

                        //フォーム送信用に、画面に表示された実行結果を hidden input (execution-output) にセット
                        const hiddenOutput = document.getElementById("execution-output");
                        if(hiddenOutput){
                            hiddenOutput.value = outputDiv.textContent;
                        }

                        button.disabled = false;
                        button.textContent = '▶ Run';
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

