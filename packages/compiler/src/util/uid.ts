// Blockly's ID alphabet excludes XML special characters and dollar signs.
const BLOCK_ID_CHARACTERS = '!#%()*+,-./:;=?@[]^_`{|}~' +
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

const SHORT_ID_CHARACTERS = 'abcdefghijklmnopqrstuvwxyz0123456789';

function randomId (characters: string, length: number) {
  let id = '';
  for (let index = 0; index < length; index++) {
    id += characters.charAt(Math.random() * characters.length);
  }

  return id;
}

function uid () {
  return randomId(BLOCK_ID_CHARACTERS, 20);
}

uid.shortUid = () => randomId(SHORT_ID_CHARACTERS, 6);

export default uid;
