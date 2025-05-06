# CompiLinda 🌺

This is a project aimed at making a compiler. The grammar of the language is defined as Alan++ and as such, is the basis of the compiler.

The first version of this compiler was made with typescript and in order to make it work locally for you, make sure to clone this repository. From there, make sure you have node installed since that is what I am using to run it on a web environment. After that, in order to run the compiler, check the installation steps:

## Project Structure 📂

This compiler is the final product of a working lexer, parser, semantic analyzer, and code generator based on 6502a machine. In order to run the code, make sure to use it on one of the Hall of Fame projects! Since this is done in TypeScript, the source The project is structured as follows:

- src/
  - main.ts: The lexer implementation.
  - parser.ts: The parser implementation
  - combinedAnalyzer.ts: The semantic analyzer implementation
  - codeGeneration.ts: The code generation (back-end) implementation

The transpiled code is in the dist folder. The dist folder is the folder that is used to run the compiler and compiled from the src folder.

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
4. Run the compiler:

By running the command below, you will transpile the code and run the full compiler. Then, open **index.html** in your browser to view the front-end.
```bash
tsc
```

## Usage 👩🏾‍💻

All of the source code is in the src folder. The lexer, parser, semantic analyzer combined with code generation is a web application that allows you to compile Alan++ code into tokens then parse and create a CST, produce an AST, symbol table with scope and type checking and then sends it all to code generation. 

After running the commands above, you can run the compiler by opening the **index.html** file in your browser. Make sure to use Chrome for the best experience. Paste your source code into the text area and then click the "Compile" button see all of the outputs. 

Once everything looks correct, you should get a webpage that looks like this:

<img width="1469" alt="Screenshot 2025-05-06 at 03 47 30" src="https://github.com/user-attachments/assets/200a1858-2bc3-4342-af82-551940e047d1" />


Have fun compiling!

## Contributing

Pull requests are welcome. For major changes, please open an issue first
to discuss what you would like to change.

Please make sure to update tests as appropriate.

## License

[MIT](https://choosealicense.com/licenses/mit/)
