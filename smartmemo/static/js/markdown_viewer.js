
document.addEventListener("DOMContentLoaded", function() {
    const displayDiv= document.getElementById('memo-content-display');
    
    renderMathInElement(displayDiv, {
        delimiters: [
            {left: "$$", right: "$$", display: true},
            {left: "$", right: "$", display: false}
        ],
    });
});