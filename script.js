let peer = null;
let conn = null;
let myRole = 0; // 1 = المضيف، 2 = الضيف
let isMyTurn = false;

let deck = [];
for (let i = 0; i <= 6; i++) {
    for (let j = i; j <= 6; j++) {
        deck.push([i, j]);
    }
}

let playerHand = [];
let board = [];
let leftEnd = null;
let rightEnd = null;

const gameStatus = document.getElementById("game-status");
const myIdDisplay = document.getElementById("my-id-display");
const boardArea = document.getElementById("board-area");
const playerHandEl = document.getElementById("player-hand");
const p1ScoreEl = document.getElementById("p1-score");
const p2ScoreEl = document.getElementById("p2-score");
const handTitle = document.getElementById("hand-title");
const chatBox = document.getElementById("chat-box");
const chatInput = document.getElementById("chat-input");
const sendBtn = document.getElementById("send-btn");
const drawBtn = document.getElementById("draw-btn");

function initPeer() {
    peer = new Peer();

    peer.on('open', (id) => {
        myIdDisplay.textContent = "الرابط جاهز للمشاركة مع صديقك!";
        
        const urlParams = new URLSearchParams(window.location.search);
        const hostId = urlParams.get('connect');

        if (hostId) {
            myRole = 2;
            gameStatus.textContent = "جاري الاتصال بالغرفة...";
            conn = peer.connect(hostId);
            setupConnection();
        } else {
            myRole = 1;
            gameStatus.textContent = "في انتظار انضمام الصديق...";
        }
    });

    peer.on('connection', (incomingConn) => {
        if (myRole === 1) {
            conn = incomingConn;
            setupConnection();
            startGameAsHost();
        }
    });
}

function copyInviteLink() {
    const inviteUrl = `${window.location.origin}${window.location.pathname}?connect=${peer.id}`;
    navigator.clipboard.writeText(inviteUrl).then(() => {
        myIdDisplay.textContent = "تم نسخ رابط التحدي بنجاح! 📋";
    });
}

function setupConnection() {
    conn.on('open', () => {
        gameStatus.textContent = "تم الاتصال بنجاح!";
        chatInput.disabled = false;
        sendBtn.disabled = false;
        drawBtn.disabled = false;
        addChatMessage("النظام", "⚡ تم الاتصال بصديقك بنجاح، استعد للعبة!");
    });

    conn.on('data', (data) => {
        handleIncomingData(data);
    });
}

function startGameAsHost() {
    deck.sort(() => Math.random() - 0.5);
    let p1 = deck.splice(0, 7);
    let p2 = deck.splice(0, 7);

    isMyTurn = true;
    playerHand = p1;
    
    conn.send({
        type: 'START_GAME',
        deck: deck,
        guestHand: p2,
        board: [],
        turn: 2
    });

    renderGame();
}

function handleIncomingData(data) {
    if (data.type === 'START_GAME') {
        deck = data.deck;
        playerHand = data.guestHand;
        board = data.board;
        isMyTurn = false;
        renderGame();
    } else if (data.type === 'PLAY_TILE') {
        board = data.board;
        leftEnd = data.leftEnd;
        rightEnd = data.rightEnd;
        isMyTurn = true;
        renderGame();
    } else if (data.type === 'CHAT') {
        addChatMessage("الصديق", data.text);
    }
}

function renderGame() {
    if (board.length === 0) {
        boardArea.innerHTML = `<div class="board-placeholder">الطاولة فارغة، ابدأ بلعب أول قطعة!</div>`;
    } else {
        boardArea.innerHTML = "";
        board.forEach(tile => {
            let div = document.createElement("div");
            div.className = "domino-tile";
            div.style.borderColor = "#444";
            div.textContent = `[${tile[0]} | ${tile[1]}]`;
            boardArea.appendChild(div);
        });
        boardArea.scrollLeft = boardArea.scrollWidth;
    }

    playerHandEl.innerHTML = "";
    playerHand.forEach((tile, index) => {
        let div = document.createElement("div");
        div.className = "domino-tile";
        div.textContent = `[${tile[0]} | ${tile[1]}]`;
        div.onclick = () => playTile(index);
        playerHandEl.appendChild(div);
    });

    gameStatus.textContent = isMyTurn ? "دورك الآن! 🔥" : "دور صديقك... ⏳";
    handTitle.textContent = `قطعك (${playerHand.length}):`;
}

function playTile(index) {
    if (!isMyTurn) {
        addChatMessage("النظام", "⏳ ليس دورك الآن، انتظر دور صديقك!");
        return;
    }

    let tile = playerHand[index];

    if (board.length === 0) {
        board.push(tile);
        leftEnd = tile[0];
        rightEnd = tile[1];
        playerHand.splice(index, 1);
        isMyTurn = false;
        sendGameState();
    } else {
        if (tile[0] === leftEnd || tile[1] === leftEnd) {
            if (tile[1] === leftEnd) {
                board.unshift(tile);
                leftEnd = tile[0];
            } else {
                board.unshift([tile[1], tile[0]]);
                leftEnd = tile[1];
            }
            playerHand.splice(index, 1);
            isMyTurn = false;
            sendGameState();
        } else if (tile[0] === rightEnd || tile[1] === rightEnd) {
            if (tile[0] === rightEnd) {
                board.push(tile);
                rightEnd = tile[1];
            } else {
                board.push([tile[1], tile[0]]);
                rightEnd = tile[0];
            }
            playerHand.splice(index, 1);
            isMyTurn = false;
            sendGameState();
        } else {
            addChatMessage("النظام", "❌ هذه القطعة لا تطابق أطراف الطاولة!");
        }
    }
    renderGame();
}

function sendGameState() {
    if (conn && conn.open) {
        conn.send({
            type: 'PLAY_TILE',
            board: board,
            leftEnd: leftEnd,
            rightEnd: rightEnd
        });
    }
}

function drawTile() {
    if (deck.length > 0 && isMyTurn) {
        let drawn = deck.pop();
        playerHand.push(drawn);
        addChatMessage("النظام", "📥 سحبت قطعة جديدة من البنك.");
        renderGame();
    } else {
        addChatMessage("النظام", "البنك فارغ أو ليس دورك!");
    }
}

function sendCustomMessage() {
    let text = chatInput.value.trim();
    if (text !== "" && conn && conn.open) {
        addChatMessage("أنت (NACIM)", text);
        conn.send({ type: 'CHAT', text: text });
        chatInput.value = "";
    }
}

chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendCustomMessage();
});

function addChatMessage(sender, text) {
    let msgDiv = document.createElement("div");
    msgDiv.className = "msg";
    msgDiv.innerHTML = `<b>${sender}:</b> ${text}`;
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

initPeer();