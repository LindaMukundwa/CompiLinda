# CompiLinda 🌺

This is a project aimed at making a compiler, with beginning stages at a lexer. This project is a work in progress and will be updated as I continue to work on it. The grammar of the language is defined as Alan++ and as such, is the basis of the lexer.

The first version of this lexer was made with typescript and in order to make it work locally for you, make sure to clone this repository. From there, make sure you have node installed since that is what I am using to run it on a web environment. After that, in order to run the lexer, check the installation steps:

## Installation

1. Clone the repository:

```bash
git clone https://github.com/LindaMukundwa/CompiLinda
cd CompiLinda
```

2. Install the dependecies:

```bash
npm install
npm run build
```
3. Run the lexer:

```bash
node src/main.ts
npm run build
```

## Usage

All of the source code is in the src folder. The main.ts file is the entry point of the lexer. The lexer is a web application that allows you to compile Alan++ code into tokens.

After running the commands above, you can run the lexer by opening the index.html file in your browser. Make sure to use Chrome for the best experience. Paste your source code into the text area and then click the "Compile" button to run the lexer and view the tokens. 


## Contributing

Pull requests are welcome. For major changes, please open an issue first
to discuss what you would like to change.

Please make sure to update tests as appropriate.

## License

[MIT](https://choosealicense.com/licenses/mit/)