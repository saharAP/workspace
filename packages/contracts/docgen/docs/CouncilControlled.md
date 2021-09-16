# CouncilControlled
***
## Functions:
- [`constructor()`](#constructor_)
- [`nominateNewCouncil()`](#nominateNewCouncil_)
- [`acceptCouncil()`](#acceptCouncil_)
- [`nominateFirstCouncil()`](#nominateFirstCouncil_)
- [`getCouncil()`](#getCouncil_)
## Events:
- [`CouncilNominated`](#CouncilNominated_)
- [`CouncilChanged`](#CouncilChanged_)
## Modifiers:
- [`onlyCouncil()`](#onlyCouncil_)
***
## Function Definitions:
### <a name="constructor_"></a> constructor() {#constructor_}
```
constructor(address _council, contract IRegion _region) public 
```
### <a name="nominateNewCouncil_"></a> nominateNewCouncil() {#nominateNewCouncil_}
```
nominateNewCouncil(address _council, bytes2 _region) external 
```
### <a name="acceptCouncil_"></a> acceptCouncil() {#acceptCouncil_}
```
acceptCouncil(bytes2 _region) external 
```
### <a name="nominateFirstCouncil_"></a> nominateFirstCouncil() {#nominateFirstCouncil_}
```
nominateFirstCouncil(address _council, bytes2 _region) external 
```
### <a name="getCouncil_"></a> getCouncil() {#getCouncil_}
```
getCouncil(bytes2 _region) public  returns (address)
```
## Events
### <a name="CouncilNominated_"></a> CouncilNominated {#CouncilNominated_}
```
CouncilNominated(bytes2 _region, address newCouncil)
```
### <a name="CouncilChanged_"></a> CouncilChanged {#CouncilChanged_}
```
CouncilChanged(bytes2 _region, address oldCouncil, address newCouncil)
```
## Modifiers
### <a name="onlyCouncil_"></a> `onlyCouncil()` {#onlyCouncil_}
```
onlyCouncil(bytes2 _region)
```
## Dependency Graph
![Dependency Graph](CouncilControlled_graph.png)
## Inheritance Graph
![Inheritance Graph](CouncilControlled_inheritance.png)
