export function playcard(iaCard, playerCard) { // função de comparar cartas
    const cardScores = JSON.parse(localStorage.getItem('scoresCards'));

    const iacardValue   = cardScores[iaCard]     ?? 0;
    const playcardValue = cardScores[playerCard] ?? 0;

    let roundWinner;
    if (iacardValue > playcardValue) {
        roundWinner = 'ia';
    } else if (playcardValue > iacardValue) {
        roundWinner = 'player';
    } else {
        roundWinner = 'cangou';
    }

    // Atualiza rodada e pontuações no localStorage
    const status = JSON.parse(localStorage.getItem('statusGame'));
    const playerObj = JSON.parse(localStorage.getItem('playerObj'));
    const iaObj     = JSON.parse(localStorage.getItem('iaObj'));

    status.round += 1;
    status.roundResults = Array.isArray(status.roundResults) ? status.roundResults : [];
    status.roundResults.push(roundWinner);

    if (roundWinner === 'player') {
        playerObj.roundWins += 1;
    } else if (roundWinner === 'ia') {
        iaObj.roundWins += 1;
    }

    localStorage.setItem('statusGame', JSON.stringify(status));
    localStorage.setItem('playerObj',  JSON.stringify(playerObj));
    localStorage.setItem('iaObj',      JSON.stringify(iaObj));

    return { roundWinner, round: status.round, playerRoundWins: playerObj.roundWins, iaRoundWins: iaObj.roundWins };
}

export function checkHandWinner() { // Função que verifica o vencedor
    const playerObj = JSON.parse(localStorage.getItem('playerObj'));
    const iaObj     = JSON.parse(localStorage.getItem('iaObj'));
    const status    = JSON.parse(localStorage.getItem('statusGame'));

    const results = Array.isArray(status.roundResults) ? status.roundResults : [];

    // Ganha a mão quem vencer duas rodadas.
    if (playerObj.roundWins >= 2) return 'player';
    if (iaObj.roundWins >= 2)     return 'ia';

    // No Truco, se uma das duas primeiras rodadas canga, a outra rodada
    // decide a mão. Ex.: jogador vence a primeira e a segunda empata.
    if (results.length === 2 && results.includes('cangou')) {
        const decisiveRound = results.find((winner) => winner !== 'cangou');
        if (decisiveRound) return decisiveRound;
    }

    if (results.length >= 3) {
        const lastRound = results[2];

        // A terceira rodada decide quando não empata. Se ela também cangar,
        // vence quem ganhou a primeira rodada não empatada; se todas
        // cangarem, vence quem é mão.
        if (lastRound !== 'cangou') return lastRound;

        const firstDecisiveRound = results.find((winner) => winner !== 'cangou');
        return firstDecisiveRound || status.handLeader || 'player';
    }

    return null; // mão ainda em andamento
}

export function addPoint(winner) { // Função de Adiciona pontos ao vencedor da mão
    if (!winner || winner === 'empate') return;
    const key = winner === 'player' ? 'playerObj' : 'iaObj'; // Define a chave correta para o vencedor
    const status = JSON.parse(localStorage.getItem('statusGame')) || {};
    const obj = JSON.parse(localStorage.getItem(key)); // Recupera o objeto do vencedor
    obj.points += status.handPoints || 1; // Adiciona os pontos da mão ao vencedor
    localStorage.setItem(key, JSON.stringify(obj)); // Salva o objeto atualizado
}

export function checkGameWinner() { // Função que checa o vencedor
    const playerObj = JSON.parse(localStorage.getItem('playerObj'));
    const iaObj     = JSON.parse(localStorage.getItem('iaObj'));
    if (playerObj.points >= 12) return 'player';
    if (iaObj.points     >= 12) return 'ia';
    return null;
}

const trucoPhases = [ // Fases do truco(com audio)
    {
        key: 'truco',
        label: 'Truco',
        points: 3,
        audioFolder: 'truco',
        audioFile: 'truco.mp3'
    },
    {
        key: 'six',
        label: 'Seis',
        points: 6,
        audioFolder: 'six',
        audioFile: 'seis.mp3'
    },
    {
        key: 'nine',
        label: 'Nove',
        points: 9,
        audioFolder: 'nine',
        audioFile: 'nove.mp3'
    },
    {
        key: 'twelve',
        label: 'Doze',
        points: 12,
        audioFolder: 'twelve',
        audioFile: 'doze.mp3'
    }
];

function getTrucoPhase() { // busca a fase atual do truco(3,6,9,12)
    const status = JSON.parse(localStorage.getItem('statusGame')) || {};
    return trucoPhases.find((phase) => phase.key === status.trucoPhase) || null;
}

function getNextTrucoPhase(phase) { // busca a próxima fase do truco(3,6,9,12)
    const phaseIndex = trucoPhases.findIndex(({ key }) => key === phase.key);
    return trucoPhases[phaseIndex + 1] || null;
}

export function getTrucoButtonLabel() {  // Função que retorna o label do botão de truco
    return getTrucoPhase()?.label || 'Limite atingido';
}

export function getHandPoints() { // Função que retorna a quantidade de pontos da mão
    const status = JSON.parse(localStorage.getItem('statusGame')) || {};
    return status.handPoints || 1;
}

export function canRequestTruco() { // Função que verifica se é possível pedir truco
    const status = JSON.parse(localStorage.getItem('statusGame')) || {};
    return Boolean(getTrucoPhase()) && !status.trucoPending;
}

export function Truco(caller = 'player') { // Função que solicita o aumento de pontos da mão ou o Truco
    const phase = getTrucoPhase();
    const status = JSON.parse(localStorage.getItem('statusGame')) || {};

    if (!phase || status.trucoPending) {
        return Promise.reject(new Error('Não há aumento de Truco disponível.')); // Retorna null se não tiver truco disponível ou se já houver um pedido pendente
    }

    status.trucoPending = caller;
    localStorage.setItem('statusGame', JSON.stringify(status));

    const audioUrl = new URL( // Cria a URL do áudio do Truco
        `../../audio/${phase.audioFolder}/${phase.audioFile}`,
        import.meta.url
    );
    const audio = new Audio(audioUrl.href);

    // O pedido permanece válido mesmo que o navegador não consiga reproduzir o som.
    return audio.play().catch((error) => {
        console.warn('Não foi possível reproduzir o áudio do Truco.', error);
    });
}

export function acceptTruco() { // Função que aceita o aumento de pontos da mão ou o Truco
    const phase = getTrucoPhase();
    const status = JSON.parse(localStorage.getItem('statusGame')) || {};

    if (!phase || !status.trucoPending) return null;

    const nextPhase = getNextTrucoPhase(phase);
    status.handPoints = phase.points;
    status.trucoPhase = nextPhase?.key || null;
    status.trucoPending = null;
    localStorage.setItem('statusGame', JSON.stringify(status));

    return { phase, nextPhase };
}

export function refuseTruco() { // Função que recusa o aumento de pontos da mão ou o Truco
    const status = JSON.parse(localStorage.getItem('statusGame')) || {};
    const winner = status.trucoPending;

    if (!winner) return null;

    status.trucoPending = null;
    localStorage.setItem('statusGame', JSON.stringify(status));

    return winner;
}
