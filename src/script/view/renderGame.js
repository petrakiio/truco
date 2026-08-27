import { dealCards } from "../controller/destributionGame.js?v=7";
import { playcard, checkHandWinner, addPoint, checkGameWinner, Truco, acceptTruco, refuseTruco, canRequestTruco, getTrucoButtonLabel, getHandPoints } from "../controller/manageGame.js?v=7";
import { Ia } from "../model/ia.js?v=7";

let playerDeck = [];
let ia;
let pendingIaMove = null;
let playerDeckSignature = '';
let gameActive = false;
let handEnding = false;
let arenaClearTimeout = null;
const shackles = ['7♦️', '7❤️', '4♣️', 'A♠️'];

// elementos fixos 
const result      = document.getElementById('result');
const scoreboard  = (() => {
    let el = document.getElementById('scoreboard');
    if (!el) {
        el = document.createElement('div');
        el.id = 'scoreboard';
        document.body.insertBefore(el, document.body.firstChild.nextSibling);
    }
    el.className = 'scoreboard';
    return el;
})();

const roundInfo   = (() => {
    let el = document.getElementById('round-info');
    if (!el) {
        el = document.createElement('div');
        el.id = 'round-info';
        document.body.insertBefore(el, scoreboard.nextSibling);
    }
    el.className = 'round-info';
    return el;
})();

// atualiza placar no topo 
function updateScoreboard() {
    const p = JSON.parse(localStorage.getItem('playerObj'));
    const i = JSON.parse(localStorage.getItem('iaObj'));
    scoreboard.innerHTML =
        `<div class="score-block"><span class="score-label">Você</span><span class="score-value">${p.points}</span></div>` +
        `<span class="score-divider">VS</span>` +
        `<div class="score-block"><span class="score-label">IA</span><span class="score-value">${i.points}</span></div>`;
}

// atualiza info de rodada 
function updateRoundInfo() {
    const s = JSON.parse(localStorage.getItem('statusGame'));
    const p = JSON.parse(localStorage.getItem('playerObj'));
    const ia = JSON.parse(localStorage.getItem('iaObj'));
    roundInfo.textContent = `Rodada ${s.round + 1}/3 | Mão: ${getHandPoints()} | Você ${p.roundWins} · IA ${ia.roundWins}`;
}

function setGameMessage(title = '', detail = '', tone = 'neutral') {
    result.className = `result-message is-${tone}`;
    result.replaceChildren();
    if (!title) return;

    const titleElement = document.createElement('span');
    titleElement.className = 'result-title';
    titleElement.textContent = title;
    result.appendChild(titleElement);

    if (detail) {
        const detailElement = document.createElement('span');
        detailElement.className = 'result-detail';
        detailElement.textContent = detail;
        result.appendChild(detailElement);
    }
}

function getCardParts(cardValue) {
    return {
        value: cardValue.charAt(0),
        suit: cardValue.includes('❤️') ? '♥' : cardValue.replace(cardValue.charAt(0), '').replace('️', '')
    };
}

function applyCardData(card, cardValue) {
    const { value, suit } = getCardParts(cardValue);
    card.dataset.value = value;
    card.dataset.suit = suit;
}

function syncPlayerDeckFromStorage() {
    const player = JSON.parse(localStorage.getItem('playerObj')) || {};

    // Para roubar no Console do DevTools, cole: const p = JSON.parse(localStorage.playerObj); p.deck = ["4♣️", "7❤️", "A♠️"]; localStorage.playerObj = JSON.stringify(p);
    // A mão é relida para que essa alteração manual tenha efeito na próxima carta jogada.
    if (!Array.isArray(player.deck)) return false;

    const nextDeck = [...player.deck];
    const nextSignature = JSON.stringify(nextDeck);
    const changed = nextSignature !== playerDeckSignature;
    playerDeck = nextDeck;
    playerDeckSignature = nextSignature;
    return changed;
}

function savePlayerDeck() {
    const player = JSON.parse(localStorage.getItem('playerObj')) || {};
    player.deck = [...playerDeck];
    localStorage.setItem('playerObj', JSON.stringify(player));
    playerDeckSignature = JSON.stringify(playerDeck);
}

function refreshPlayerDeckFromStorage() {
    const status = JSON.parse(localStorage.getItem('statusGame')) || {};
    if (!gameActive || pendingIaMove || status.trucoPending) return;

    if (syncPlayerDeckFromStorage()) {
        updateLayout();
        setGameMessage('Mão atualizada', 'Cartas carregadas do localStorage.', 'warning');
    }
}

function createTrucoButton() {
    const oldButton = document.getElementById('BtnTruco');
    if (oldButton) oldButton.remove();

    const btnTruco = document.createElement('button');
    btnTruco.id = 'BtnTruco';
    btnTruco.type = 'button';
    btnTruco.textContent = `Pedir ${getTrucoButtonLabel()}`;
    btnTruco.disabled = !gameActive || handEnding || !canRequestTruco();
    btnTruco.addEventListener('click', () => {
        if (!gameActive || handEnding || !canRequestTruco()) return;
        const phaseLabel = getTrucoButtonLabel();
        btnTruco.disabled = true;
        setPlayerCardsDisabled(true);
        Truco('player');
        setGameMessage(`Você pediu ${phaseLabel}`, 'A IA está avaliando a mão.', 'warning');

        window.setTimeout(() => respondToPlayerTruco(), 650);
    });

    return btnTruco;
}

function clearTrucoResponse() {
    document.getElementById('truco-response')?.remove();
}

function updateTrucoButton() {
    const button = document.getElementById('BtnTruco');
    if (!button) return;

    button.textContent = `Pedir ${getTrucoButtonLabel()}`;
    button.disabled = !gameActive || handEnding || !canRequestTruco();
}

function setPlayerCardsDisabled(disabled) {
    document.querySelectorAll('.player-cards .letters-div, .player-cards .manilha').forEach((card) => {
        card.style.pointerEvents = disabled ? 'none' : '';
        card.style.opacity = disabled ? '0.55' : '';
    });
}

function finishTrucoRefusal(winner) {
    clearTrucoResponse();
    pendingIaMove = null;
    handEnding = true;
    setPlayerCardsDisabled(true);
    const iaWon = winner === 'ia';
    setGameMessage(
        iaWon ? 'Você correu' : 'A IA correu',
        `${iaWon ? 'IA' : 'Você'} recebe ${getHandPoints()} ponto(s).`,
        iaWon ? 'danger' : 'success'
    );
    endHand(winner);
}

function respondToPlayerTruco() {
    const cardScores = JSON.parse(localStorage.getItem('scoresCards')) || {};
    const statusGame = JSON.parse(localStorage.getItem('statusGame')) || {};
    if (statusGame.trucoPending !== 'player') return;
    const accepted = ia.shouldAcceptTruco(cardScores, statusGame);

    if (!accepted) {
        const winner = refuseTruco();
        if (winner) finishTrucoRefusal(winner);
        return;
    }

    const acceptedTruco = acceptTruco();
    if (!acceptedTruco) return;

    setGameMessage('Pedido aceito', `A mão agora vale ${getHandPoints()} ponto(s).`, 'warning');
    updateRoundInfo();
    updateTrucoButton();
    setPlayerCardsDisabled(false);
}

function showIaTrucoResponse(phaseLabel) {
    clearTrucoResponse();
    const response = document.createElement('div');
    response.id = 'truco-response';
    response.innerHTML = `<span>IA pediu ${phaseLabel}!</span>`;
    setGameMessage(`IA pediu ${phaseLabel}`, 'A mão ainda vale o valor anterior.', 'danger');

    const acceptButton = document.createElement('button');
    acceptButton.type = 'button';
    acceptButton.className = 'truco-response-button accept';
    acceptButton.textContent = 'Aceitar';
    acceptButton.addEventListener('click', () => {
        const acceptedTruco = acceptTruco();
        if (!acceptedTruco || !pendingIaMove) return;

        clearTrucoResponse();
        setGameMessage('Pedido aceito', `A mão agora vale ${getHandPoints()} ponto(s).`, 'warning');
        updateRoundInfo();
        updateTrucoButton();

        const move = pendingIaMove;
        pendingIaMove = null;
        playRound(move.playerCard, move.index, move.iaCard, `IA pediu ${acceptedTruco.phase.label}. Você aceitou. `);
    });

    const runButton = document.createElement('button');
    runButton.type = 'button';
    runButton.className = 'truco-response-button run';
    runButton.textContent = 'Correr';
    runButton.addEventListener('click', () => {
        const winner = refuseTruco();
        if (winner) finishTrucoRefusal(winner);
    });

    response.append(acceptButton, runButton);
    document.querySelector('.player-area').appendChild(response);
}

function decideIaTurn(cardScores, statusGame) {
    if (typeof ia.decideTurn === 'function') {
        return ia.decideTurn(cardScores, statusGame);
    }

    return {
        type: 'play-card',
        card: ia.play(cardScores)
    };
}

// cria layout inicial de uma mão 
function createLayout() {
    const dados = dealCards();
    ia = new Ia(dados.iaDeck);
    playerDeck = dados.playerDeck;
    playerDeckSignature = JSON.stringify(playerDeck);
    gameActive = true;
    handEnding = false;
    pendingIaMove = null;
    clearTrucoResponse();

    // containers de cartas 
    const playerContainer = document.querySelector(".player-cards");
    const iaContainer = document.querySelector(".ia-cards");

    // cartas viradas da IA 
    iaContainer.innerHTML = "";
    for (let i = 0; i < dados.iaDeck.length; i++) {
        const card = document.createElement("div");
        card.className = "back-card";
        iaContainer.appendChild(card);
    }

    setGameMessage();
    updateScoreboard();
    updateRoundInfo();
    updateLayout();

    //Adiciona button
    const selection = document.querySelector('.player-area');
    const btnTruco = createTrucoButton();
    selection.appendChild(btnTruco);

    const btn = document.getElementById("btn_start");
    if (btn) btn.remove();
}

//  re-renderiza cartas do jogador 
function updateLayout() {
    const container = document.querySelector(".player-cards");
    if (!container) return;
    syncPlayerDeckFromStorage();
    container.innerHTML = "";

    playerDeck.forEach((cardValue, index) => {
        const card = document.createElement("div");
        card.textContent = cardValue;
        card.className = shackles.includes(cardValue) ? "manilha" : "letters-div";
        applyCardData(card, cardValue);

        card.addEventListener("click", () => handleCardClick(index));
        container.appendChild(card);
    });
}

// lógica de clique numa carta 
function handleCardClick(index) {
    if (!gameActive || handEnding || pendingIaMove) return;

    syncPlayerDeckFromStorage();
    const playerCard = playerDeck[index];
    if (!playerCard) return;

    const cardScores = JSON.parse(localStorage.getItem('scoresCards'));
    const statusGame = JSON.parse(localStorage.getItem('statusGame'));
    if (statusGame.trucoPending) return;
    const iaDecision = decideIaTurn(cardScores, statusGame);
    const iaCalledTruco = iaDecision.type === 'truco';

    if (iaCalledTruco) {
        const phaseLabel = getTrucoButtonLabel();
        pendingIaMove = { playerCard, index, iaCard: iaDecision.card };
        setPlayerCardsDisabled(true);
        Truco('ia')
            .catch((error) => console.warn(error.message))
            .finally(() => showIaTrucoResponse(phaseLabel));
        updateTrucoButton();
        return;
    }

    playRound(playerCard, index, iaDecision.card);
}

function playRound(playerCard, index, iaCard, trucoContext = '') {
    setPlayerCardsDisabled(false);

    // IA escolhe e remove a carta
    ia.removeCard(iaCard);

    // Remove carta do jogador 
    playerDeck.splice(index, 1);
    savePlayerDeck();

    // Atualiza visual da IA 
    const iaContainer = document.querySelector(".ia-cards");
    if (iaContainer.firstChild) iaContainer.removeChild(iaContainer.firstChild);

    // Avalia rodada 
    const { roundWinner, playerRoundWins, iaRoundWins } = playcard(iaCard, playerCard);

    // Mostra carta jogada pela IA 
    showPlayedCards(iaCard, playerCard, roundWinner);

    // Mensagem de rodada 
    if (roundWinner === 'player') {
        setGameMessage('Você venceu a rodada', `${trucoContext}${playerCard} supera ${iaCard}.`, 'success');
    } else if (roundWinner === 'ia') {
        setGameMessage('A IA venceu a rodada', `${trucoContext}${iaCard} supera ${playerCard}.`, 'danger');
    } else {
        setGameMessage('Rodada empatada', `${trucoContext}${playerCard} e ${iaCard} têm o mesmo valor.`, 'warning');
    }

    updateRoundInfo();

    // Verifica fim da mão 
    const handWinner = checkHandWinner();
    if (handWinner !== null) {
        handEnding = true;
        setPlayerCardsDisabled(true);
        updateTrucoButton();
        setTimeout(() => endHand(handWinner), 900);
        return;
    }

    // Ainda tem rodadas → atualiza cartas 
    updateLayout();
}

// exibe cartas jogadas no centro 
function showPlayedCards(iaCard, playerCard, winner) {
    const arena = document.getElementById('arena');
    const winColor = winner === 'player' ? '#4ade80' : winner === 'ia' ? '#f87171' : '#facc15';
    const iaParts = getCardParts(iaCard);
    const playerParts = getCardParts(playerCard);
    arena.innerHTML =
        `<div class="played-card ia-played" data-value="${iaParts.value}" data-suit="${iaParts.suit}">${iaCard}</div>` +
        `<div class="vs" style="color:${winColor}">VS</div>` +
        `<div class="played-card player-played" data-value="${playerParts.value}" data-suit="${playerParts.suit}">${playerCard}</div>`;
    if (arenaClearTimeout) clearTimeout(arenaClearTimeout);
    arenaClearTimeout = setTimeout(() => {
        arena.innerHTML = '';
        arenaClearTimeout = null;
    }, 1200);
}

// fim de mão 
function endHand(handWinner) {
    if (!gameActive) return;
    gameActive = false;
    handEnding = true;
    localStorage.removeItem('statusPlay');
    setPlayerCardsDisabled(true);
    addPoint(handWinner);
    updateScoreboard();

    const gameWinner = checkGameWinner();
    if (gameWinner) {
        endGame(gameWinner);
        return;
    }

    if (handWinner === 'player') {
        setGameMessage('Você venceu a mão', 'Preparando a próxima mão.', 'success');
    } else if (handWinner === 'ia') {
        setGameMessage('A IA venceu a mão', 'Preparando a próxima mão.', 'danger');
    } else {
        setGameMessage('Mão empatada', 'Preparando a próxima mão.', 'warning');
    }

    // limpa cartas e inicia nova mão após 2s
    setTimeout(() => {
        document.querySelector('.player-cards').innerHTML = '';
        document.querySelector('.ia-cards').innerHTML = '';
        createLayout();
    }, 2000);
}

// fim de jogo 
function endGame(winner) {
    gameActive = false;
    document.querySelector('.player-cards').innerHTML = '';
    document.querySelector('.ia-cards').innerHTML = '';
    const btnTruco = document.getElementById('BtnTruco');
    if (btnTruco) btnTruco.remove();

    setGameMessage(
        winner === 'player' ? 'Você venceu o jogo' : 'A IA venceu o jogo',
        winner === 'player' ? 'Boa partida.' : 'A próxima mão pode virar o jogo.',
        winner === 'player' ? 'success' : 'danger'
    );

    const restartBtn = document.createElement('button');
    restartBtn.id = 'btn_start';
    restartBtn.textContent = 'Jogar Novamente';
    restartBtn.addEventListener('click', () => {
        ['playerObj', 'iaObj', 'statusGame', 'scoresCards', 'statusPlay'].forEach((key) => localStorage.removeItem(key));
        setGameMessage();
        roundInfo.innerHTML = '';
        scoreboard.innerHTML = '';
        restartBtn.remove();
        createLayout();
    });
    document.getElementById('game-container').appendChild(restartBtn);
}

/* ── inicia ── */
document.getElementById("btn_start").addEventListener("click", createLayout);

// O evento cobre mudanças feitas por outra aba; o intervalo cobre mudanças no Console desta aba.
window.addEventListener('storage', (event) => {
    if (event.key === 'playerObj') refreshPlayerDeckFromStorage();
});
window.setInterval(refreshPlayerDeckFromStorage, 300);
