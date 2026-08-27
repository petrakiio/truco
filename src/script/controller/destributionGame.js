import { createDeck } from "./deckGame.js";

function shuffleDeck(deck) { // Embaralha o baralho
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));

        [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    return deck;
}

export function dealCards() { // função para distribuir as cartas(player e IA)

    const deck = shuffleDeck(createDeck());
    const iaFavoredCards = ['4♣️', '7❤️', 'A♠️']; // Da vantegem para a IA, cartas que são manilhas e tem pontuação alta
    const allManilhas = [...iaFavoredCards, '7♦️'];
    const iaManilha = iaFavoredCards[Math.floor(Math.random() * iaFavoredCards.length)];

    // A IA recebe uma única manilha por mão; as demais cartas dela são sorteadas normalmente.
    const commonCards = deck.filter((card) => !allManilhas.includes(card));
    const iaDeck = [iaManilha, ...commonCards.slice(0, 2)];
    const playerDeck = commonCards.slice(2, 5);

    const currentPlayer = JSON.parse(localStorage.getItem("playerObj")) || {};
    const currentIa = JSON.parse(localStorage.getItem("iaObj")) || {};

    localStorage.setItem("playerObj", JSON.stringify({ // Cria registro do Player
        points: currentPlayer.points || 0,
        roundWins: 0,
        deck: playerDeck
    }));

    localStorage.setItem("statusPlay",true); // Cria o registro de partida.

    localStorage.setItem("iaObj", JSON.stringify({ // Cria registro da IA
        points: currentIa.points || 0,
        roundWins: 0,
        deck: iaDeck
    }));

    localStorage.setItem("statusGame",JSON.stringify({ // Cria registro do jogo
        round: 0,
        roundResults: [],
        // O jogador inicia as rodadas nesta versão. Esta informação decide uma
        // mão em que todas as rodadas terminam empatadas.
        handLeader: "player",
        trucoPhase: "truco",
        trucoPending: null,
        handPoints: 1
    }));
    const cardScores = { // Pontuação das cartas
    '4♣️': 15,
    '7❤️': 14,
    'A♠️': 13,
    '7♦️': 12,


    '3♠️': 11,
    '3♦️': 11,
    '3❤️': 11,
    '3♣️': 11,

    '2♠️': 10,
    '2♦️': 10,
    '2❤️': 10,
    '2♣️': 10,

    'A♦️': 9,
    'A❤️': 9,
    'A♣️': 9,

    'K♠️': 7,
    'K♦️': 7,
    'K❤️': 7,
    'K♣️': 7,

    'J♠️': 6,
    'J♦️': 6,
    'J❤️': 6,
    'J♣️': 6,

    'Q♠️': 5,
    'Q♦️': 5,
    'Q❤️': 5,
    'Q♣️': 5
    };

    localStorage.setItem("scoresCards", JSON.stringify(cardScores)); // Salva a pontuação das cartas

    return { iaDeck, playerDeck };
}
