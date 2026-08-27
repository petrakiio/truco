// arrays de cartas e simbolos
const letters = ['Q','J','K','A','2','3'];
const symbols = ['♦️','♠️','❤️','♣️'];


export function createDeck(){

    let deck = [];
    const shackles = ['7♦️','7❤️','4♣️']; 

    for ( let i = 0; i < letters.length; i++){

        for ( let j = 0; j < symbols.length; j++){

            const letter = letters[i] + symbols[j];
            deck.push(letter);

        }
    }


    for ( let s = 0; s < shackles.length; s++){
        deck.push(shackles[s]);
    }

    return deck; // Retorna o baralho completo

}

