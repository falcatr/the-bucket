// Aquarium vocabulary. Each emotion contains one entry for each of
// the 10 language groups requested for this first pass.
//
// English represents USA / UK / Australia / Canada.
// Chinese is rendered with a Simplified Chinese term for this version.
export const EMOTION_TRANSLATIONS =
  Object.freeze({
    joy: Object.freeze([
      Object.freeze({
        language: "English",
        markets: "USA / UK / Australia / Canada",
        word: "joy"
      }),
      Object.freeze({
        language: "Japanese",
        markets: "Japan",
        word: "喜び"
      }),
      Object.freeze({
        language: "Simplified Chinese",
        markets: "Mainland China / Taiwan / Hong Kong",
        word: "喜悦"
      }),
      Object.freeze({
        language: "Hindi",
        markets: "India",
        word: "आनंद"
      }),
      Object.freeze({
        language: "Russian",
        markets: "Russia",
        word: "радость"
      }),
      Object.freeze({
        language: "Korean",
        markets: "South Korea",
        word: "기쁨"
      }),
      Object.freeze({
        language: "German",
        markets: "Germany",
        word: "freude"
      }),
      Object.freeze({
        language: "Spanish",
        markets: "Mexico / Argentina",
        word: "alegría"
      }),
      Object.freeze({
        language: "Portuguese",
        markets: "Brazil",
        word: "alegria"
      }),
      Object.freeze({
        language: "Indonesian",
        markets: "Indonesia",
        word: "kegembiraan"
      })
    ]),

    rage: Object.freeze([
      Object.freeze({
        language: "English",
        markets: "USA / UK / Australia / Canada",
        word: "rage"
      }),
      Object.freeze({
        language: "Japanese",
        markets: "Japan",
        word: "激怒"
      }),
      Object.freeze({
        language: "Simplified Chinese",
        markets: "Mainland China / Taiwan / Hong Kong",
        word: "愤怒"
      }),
      Object.freeze({
        language: "Hindi",
        markets: "India",
        word: "क्रोध"
      }),
      Object.freeze({
        language: "Russian",
        markets: "Russia",
        word: "ярость"
      }),
      Object.freeze({
        language: "Korean",
        markets: "South Korea",
        word: "분노"
      }),
      Object.freeze({
        language: "German",
        markets: "Germany",
        word: "wut"
      }),
      Object.freeze({
        language: "Spanish",
        markets: "Mexico / Argentina",
        word: "ira"
      }),
      Object.freeze({
        language: "Portuguese",
        markets: "Brazil",
        word: "raiva"
      }),
      Object.freeze({
        language: "Indonesian",
        markets: "Indonesia",
        word: "amarah"
      })
    ]),

    fear: Object.freeze([
      Object.freeze({
        language: "English",
        markets: "USA / UK / Australia / Canada",
        word: "fear"
      }),
      Object.freeze({
        language: "Japanese",
        markets: "Japan",
        word: "恐れ"
      }),
      Object.freeze({
        language: "Simplified Chinese",
        markets: "Mainland China / Taiwan / Hong Kong",
        word: "恐惧"
      }),
      Object.freeze({
        language: "Hindi",
        markets: "India",
        word: "डर"
      }),
      Object.freeze({
        language: "Russian",
        markets: "Russia",
        word: "страх"
      }),
      Object.freeze({
        language: "Korean",
        markets: "South Korea",
        word: "공포"
      }),
      Object.freeze({
        language: "German",
        markets: "Germany",
        word: "angst"
      }),
      Object.freeze({
        language: "Spanish",
        markets: "Mexico / Argentina",
        word: "miedo"
      }),
      Object.freeze({
        language: "Portuguese",
        markets: "Brazil",
        word: "medo"
      }),
      Object.freeze({
        language: "Indonesian",
        markets: "Indonesia",
        word: "ketakutan"
      })
    ]),

    grief: Object.freeze([
      Object.freeze({
        language: "English",
        markets: "USA / UK / Australia / Canada",
        word: "grief"
      }),
      Object.freeze({
        language: "Japanese",
        markets: "Japan",
        word: "悲嘆"
      }),
      Object.freeze({
        language: "Simplified Chinese",
        markets: "Mainland China / Taiwan / Hong Kong",
        word: "悲伤"
      }),
      Object.freeze({
        language: "Hindi",
        markets: "India",
        word: "शोक"
      }),
      Object.freeze({
        language: "Russian",
        markets: "Russia",
        word: "скорбь"
      }),
      Object.freeze({
        language: "Korean",
        markets: "South Korea",
        word: "비탄"
      }),
      Object.freeze({
        language: "German",
        markets: "Germany",
        word: "trauer"
      }),
      Object.freeze({
        language: "Spanish",
        markets: "Mexico / Argentina",
        word: "duelo"
      }),
      Object.freeze({
        language: "Portuguese",
        markets: "Brazil",
        word: "luto"
      }),
      Object.freeze({
        language: "Indonesian",
        markets: "Indonesia",
        word: "duka"
      })
    ])
  });

export function getEmotionTranslation(
  emotion,
  randomValue =
    Math.random()
) {
  const entries =
    EMOTION_TRANSLATIONS[
      emotion
    ];

  if (
    !entries ||
    entries.length === 0
  ) {
    return null;
  }

  const index =
    Math.min(
      entries.length - 1,
      Math.floor(
        Math.max(
          0,
          Math.min(
            0.999999,
            randomValue
          )
        ) *
        entries.length
      )
    );

  return entries[index];
}
