/**
 * Immagini scelte dall'utente (galleria del telefono o file system del PC).
 * La foto viene ridotta e ritagliata in quadrato qui, sul client: cosi'
 * viaggia come data URL dentro la stessa richiesta dei dati (profilo o
 * gruppo) e non serve un servizio di upload separato.
 */

const LATO_FOTO = 320;                     // lato massimo dell'immagine salvata
const PESO_MASSIMO = 8 * 1024 * 1024; // file accettati dalla galleria / dal computer

/** Riduce e ritaglia in quadrato il file scelto, restituendolo come data URL. */
export function riduciImmagine(file) {
  return new Promise((risolvi, rifiuta) => {
    const lettore = new FileReader();
    lettore.onerror = () => rifiuta(new Error('Non riesco a leggere il file scelto'));
    lettore.onload = () => {
      const img = new Image();
      img.onerror = () => rifiuta(new Error('Il file scelto non è un’immagine valida'));
      img.onload = () => {
        const lato = Math.min(img.width, img.height);
        const dimensione = Math.min(lato, LATO_FOTO);
        const tela = document.createElement('canvas');
        tela.width = dimensione;
        tela.height = dimensione;
        const ctx = tela.getContext('2d');
        ctx.drawImage(
          img,
          (img.width - lato) / 2, (img.height - lato) / 2, lato, lato,
          0, 0, dimensione, dimensione
        );
        risolvi(tela.toDataURL('image/jpeg', 0.82));
      };
      img.src = lettore.result;
    };
    lettore.readAsDataURL(file);
  });
}

/**
 * Controlli comuni sul file scelto: dev'essere un'immagine e non troppo
 * pesante. Restituisce il messaggio d'errore da mostrare, o '' se va bene.
 */
export function controllaFile(file) {
  if (!file.type.startsWith('image/')) return 'Scegli un file immagine (JPG, PNG o WEBP)';
  if (file.size > PESO_MASSIMO) return 'Immagine troppo pesante: scegline una sotto gli 8 MB';
  return '';
}
