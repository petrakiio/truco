export class Ia {

  // Mantém uma cópia da mão recebida em dealCards, para que a remoção de uma
  // carta jogada não altere o array original criado pelo controller.
  constructor(letters) {
    this.letters = [...letters];
  }

  // Resume a força da mão usando a tabela scoresCards, criada em dealCards.
  // No baralho atual, valores 12 a 15 correspondem às quatro manilhas e
  // valores a partir de 10 incluem 2, 3 e as manilhas.
  evaluateHand(cardScores) {
    const handScores = this.letters.map((card) => cardScores[card] || 0);
    const totalScore = handScores.reduce((total, score) => total + score, 0);
    const manilhas = this.letters.filter((card) => (cardScores[card] || 0) >= 12);
    const highCards = this.letters.filter((card) => (cardScores[card] || 0) >= 10);

    return {
      totalScore,
      averageScore: handScores.length ? totalScore / handScores.length : 0,
      manilhas: manilhas.length,
      highCards: highCards.length,
      strongestCard: Math.max(...handScores, 0)
    };
  }

  // Decide se a IA pede o próximo aumento. O controller só permite o pedido
  // quando há uma fase disponível e não existe outro pedido pendente.
  // As regras abaixo ficam progressivamente mais exigentes conforme a fase:
  // truco (3), seis (6), nove (9) e doze (12 pontos).
  shouldCallTruco(cardScores, statusGame) {
    if (statusGame.trucoPending || !statusGame.trucoPhase || this.letters.length === 0) return false;

    const hand = this.evaluateHand(cardScores);
    const round = statusGame.round || 0;

    if (statusGame.trucoPhase === 'six') {
      return hand.strongestCard >= 12 && hand.averageScore >= 8;
    }

    if (statusGame.trucoPhase === 'nine') {
      return hand.manilhas >= 1 && hand.averageScore >= 9;
    }

    if (statusGame.trucoPhase === 'twelve') {
      return hand.manilhas >= 2;
    }

    if (hand.manilhas >= 2) return true;
    if (hand.manilhas === 1 && hand.highCards >= 2) return true;
    if (round === 0 && hand.averageScore >= 10) return true;
    if (round >= 1 && hand.strongestCard >= 12 && hand.averageScore >= 8) return true;

    return false;
  }

  // Decide se aceita o pedido pendente do jogador. Ao aceitar, acceptTruco()
  // atualiza handPoints para os pontos da fase atual e libera a próxima fase.
  shouldAcceptTruco(cardScores, statusGame) {
    const hand = this.evaluateHand(cardScores);
    const phase = statusGame.trucoPhase;

    if (phase === 'truco') return hand.averageScore >= 6 || hand.manilhas >= 1;
    if (phase === 'six') return hand.averageScore >= 8 || hand.manilhas >= 1;
    if (phase === 'nine') return hand.averageScore >= 10 || hand.manilhas >= 2;

    // A IA recebe uma única manilha pela mecânica do roubo. Exigir duas aqui
    // fazia ela recusar Doze sempre, entregando os 9 pontos imediatamente.
    return hand.manilhas >= 1 && (hand.averageScore >= 7 || hand.strongestCard >= 14);
  }

  // Produz o formato consumido pela view: uma ação de "truco" ou "play-card"
  // e a carta escolhida. O pedido em si é registrado pelo controller Truco().
  decideTurn(cardScores, statusGame) {
    if (this.shouldCallTruco(cardScores, statusGame)) {
      return {
        type: 'truco',
        card: this.play(cardScores)
      };
    }

    return {
      type: 'play-card',
      card: this.play(cardScores)
    };
  }

  // Escolhe a carta para a rodada. Quando possui manilhas, usa a de menor
  // pontuação para preservar as mais fortes; caso contrário, joga a carta de
  // maior valor, que será comparada por playcard() no controller.
  play(cardScores) {
    const manilhas = ['4♣️', '7❤️', 'A♠️', '7♦️'];

    const manilhasNaMao = this.letters.filter(c => manilhas.includes(c));
    
    if (manilhasNaMao.length > 0) {
      const sorted = manilhasNaMao.sort((a, b) => cardScores[a] - cardScores[b]);
      return sorted[0];
    }

    const sorted = this.letters.sort((a, b) => (cardScores[b] || 0) - (cardScores[a] || 0));
    return sorted[0];
  }

  // Sincroniza a mão interna após a view jogar uma carta, impedindo que ela
  // seja escolhida novamente nas próximas rodadas da mesma mão.
  removeCard(card) {
    const idx = this.letters.indexOf(card);
    if (idx !== -1) this.letters.splice(idx, 1);
  }
}
