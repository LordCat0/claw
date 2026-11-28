Scratch.extensions.register({
  getInfo () {
    return {
      id: 'fixture',
      blocks: [{
        opcode: 'echo',
        blockType: Scratch.BlockType.REPORTER,
        text: 'echo [VALUE]',
        arguments: {
          VALUE: {
            type: Scratch.ArgumentType.STRING
          }
        }
      }, {
        opcode: 'isEven',
        blockType: Scratch.BlockType.BOOLEAN,
        text: 'is [VALUE] even?',
        arguments: {
          VALUE: {
            type: Scratch.ArgumentType.NUMBER
          }
        }
      }, {
        opcode: 'accept',
        blockType: Scratch.BlockType.COMMAND,
        text: 'accept [VALUE]',
        arguments: {
          VALUE: {
            type: Scratch.ArgumentType.BOOLEAN
          }
        }
      }]
    };
  },
  echo ({ VALUE }) {
    return VALUE;
  },
  isEven ({ VALUE }) {
    return VALUE % 2 === 0;
  },
  accept () {
  }
});
