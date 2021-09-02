# Contributing


Welcome aboard as an Popcorn developer.

This document will get you up to speed on our expectations for contributing to the codebase. Please read through this and our [code of conduct](./CODE_OF_CONDUCT.md).


## Style guide

If you elect to use VS Code, maintaining a consistent style is easy because of the prettier integration.

Regardless, please ensure that you are using 2 space tabs.

## Inclusive language: replacement terms

In an effort to develop software with language free from  expressions or words that reflect prejudice the following terminology is recommended instead of blacklist/whitelist and master/slave:

Replace blacklist/whitelist with:
```
blocklist  / allowlist
exclude list / include list
avoid list / prefer list
```

Replace master/slave with:
```
leading / subordinate
source / replica
```



## Recommended Tools:
-  `vscode` - because we are using typescript this is very important to download. It makes the development experience much easier. free download available here: https://code.visualstudio.com/
   - recommended plugins:
    - gitlens
    - Move TS
    - ESLint
    - Docker
    - Prettier
    - Todo Tree
    - TSLint


## Git flow - submitting features/bugs:
- New features are branched off of `develop`. To create a new feature, create a new branch off of develop with the name: `feature/name-of-feature`
- To submit a bug fix create a new branch off of develop with the name `bugfix/name-of-bug`
- When your feature is ready for QA, create a pull request and share a link to the pull request

## Code standards
- All code is subject to review. If it does not meet quality standards, it may not be merged until the issues are addressed;

###  General guidelines: 

  *Function length*: functions should __rarely be greater than 20 lines of code__. Exceptions can be made. Please do not submit a PR unless the code has been refactored in an attempt to meet this standard. 

  *Declarative vs imperative* - When possible aim to write declarative code. https://tylermcginnis.com/imperative-vs-declarative-programming/

  *Use classes or es6 modules* - Use classes or es6 modules to contain your code - https://exploringjs.com/es6/ch_modules.html#sec_basics-of-es6-modules

  *const vs let vs var* - Always prefer `let` over `var`. Always prefer `const` to `let` when a variable does not need to be reassigned. Avoid variable reassignment. This makes code easier to understand and less prone to bugs.

  *any types* - when writing in typescript avoid using `any` types - always create interfaces for the inputs and outputs of your functions. On very rare occassions it is ok to use `any`.
