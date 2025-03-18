# CompiLinda 🌺

This is a project aimed at making a compiler, with the current stage at a parser. This project is a work in progress and will be updated as I continue to work on it. The grammar of the language is defined as Alan++ and as such, is the basis of the compiler.

The first version of this compiler was made with typescript and in order to make it work locally for you, make sure to clone this repository. From there, make sure you have node installed since that is what I am using to run it on a web environment. After that, in order to run the compiler, check the installation steps:

## Project Structure 📂

This compiler is a work in progress and will eventually follow a more standard compiler with a parser, semantic analyzer, and code generator. Since this is done in TypeScript, the source The project is structured as follows:

- src/
  - main.ts: The lexer implementation.
  - parser.ts: The parser implementation

The transpiled code is in the dist folder. The dist folder is the folder that is used to run the lexer and compiled from the src folder.**NOTE:** Please grade the main branch as this is the latest version of the compiler.

## Installation 📦

1. Install TypeScript:

This first step is optional for anyone who may be new to using TypeScript. Install TypeScript globally on your machine. This is so that you can run the build command to transpile the code. Optionally, you can also download node and run the build command from there. There are some dependencies that may improve your experience, but they are not required.

```bash
npm install -g typescript
```

2. Clone the repository:

```bash
git clone https://github.com/LindaMukundwa/CompiLinda
cd CompiLinda
```

3. (Optional)Install the dependecies:

```bash
npm install
npm run build
```
4. Run the lexer:

By running the command below, you will transpile the code and run the lexer and parser. Then, open **index.html** in your browser to view the compiler.
```bash
tsc
```

## Usage 👩🏾‍💻

All of the source code is in the src folder. The main.ts file is the entry point of the lexer and the parser.ts is the entry point of the parser. The lexer combined with the parser is a web application that allows you to compile Alan++ code into tokens then parse and create a CST.

After running the commands above, you can run the compiler by opening the **index.html** file in your browser. Make sure to use Chrome for the best experience. Paste your source code into the text area and then click the "Compile" button to run the lexer and view the tokens as well as the parsing in the next tab. 

Once everything looks correct, you should get a webpage that looks like this:

<img width="1456" alt="Screenshot 2025-02-16 at 16 02 27" src="https://github.com/user-attachments/assets/bb604e10-ea7f-428e-aaa4-4148efb99581" />

Have fun compiling!

## Contributing

Pull requests are welcome. For major changes, please open an issue first
to discuss what you would like to change.

Please make sure to update tests as appropriate.

## License

[MIT](https://choosealicense.com/licenses/mit/)
