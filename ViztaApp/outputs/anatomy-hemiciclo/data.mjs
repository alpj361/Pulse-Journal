// Composición del Congreso de la República de Guatemala (X Legislatura, 2024-2028).
// Fuente: observatorio del Congreso de Poder Ciudadano, leído desde la base de Pulzos
// (get_pc_observatorio('congreso', seccion 'diputados')), última lectura 2026-10-12.
// Formato por fila: posición | bloque actual | partido por el que llegó | nombre.
// La posición es el orden del observatorio (por bloque, de mayor a menor), no el número físico de curul.
const ROWS = `
0|VAMOS|VAMOS|Herman Otoniel Echeverría Casado
1|VAMOS|VAMOS|Leopoldo Salazar Samayoa
2|VAMOS|VAMOS|Maynor Gabriel Mejía Popol
3|VAMOS|VAMOS|Boris Roberto España Cáceres
4|VAMOS|VAMOS|Candido Fernando Leal Gómez
5|VAMOS|VAMOS|Shirley Joanna Rivera Zaldaña
6|VAMOS|VAMOS|César Augusto Rodas Cardona
7|VAMOS|VAMOS|Sergio David Arana Roca
8|VAMOS|VAMOS|Christian Joél Martínez Juárez
9|VAMOS|VAMOS|Erick Geovany Martínez Hernández
10|VAMOS|VAMOS|Joél Rubén Martínez Herrera
11|VAMOS|VAMOS|Sofía Jeanetth Hernández Herrera
12|VAMOS|VAMOS|Juan Ramon Rivas García
13|VAMOS|VAMOS|Thelma Elizabeth Ramirez Retana
14|VAMOS|VAMOS|Jaime Octavio Augusto Lucero Vásquez
15|VAMOS|VAMOS|Maynor Estuardo Castillo y Castillo
16|VAMOS|VAMOS|Carlos Roberto Calderon Galvez
17|VAMOS|VAMOS|Héctor Adolfo Aldana Reyes
18|VAMOS|VAMOS|Marco Alejandro Pérez Toribio
19|VAMOS|VAMOS|Mynor Alfonso De la Rosa Palacios
20|VAMOS|VAMOS|Ronald Yomelfy Portillo Cordón
21|VAMOS|VAMOS|Victor Alfredo Valenzuela Argueta
22|VAMOS|VAMOS|Edgar Raúl Reyes Lee
23|VAMOS|VAMOS|Duay Antoni Martinez Salazar
24|VAMOS|VAMOS|Erick José Mario Tzún De León
25|VAMOS|VAMOS|Greicy Domenica De León De León
26|VAMOS|VAMOS|Josué Edmundo Lemus Cifuentes
27|VAMOS|VAMOS|Manuel Geovany Alvarado Vásquez
28|VAMOS|VAMOS|José Carlo Solano
29|VAMOS|VAMOS|Gladis Carolina Cifuentes Barragán
30|VAMOS|VAMOS|Guillermo Alberto Cifuentes Barragán
31|VAMOS|VAMOS|Carlos Napoleon Rojas Alarcón
32|VAMOS|VAMOS|Ricardo Leonel Martínez Alarcón
33|VAMOS|VAMOS|Allan Estuardo Rodríguez Reyes
34|VAMOS|VAMOS|Luis Alberto Rodríguez Reyes
35|VAMOS|VAMOS|José Arnulfo García Barrios
36|VAMOS|VAMOS|Oswaldo Rosales Polanco
37|VAMOS|VAMOS|Sandra Carolina Orellana Cruz
38|IND|UNE|Darwin Alberto Lucas Paz
39|IND|NOSOTROS|Rudy Berner Pereira Delgado
40|IND|VICTORIA|Sandra Yanet Milian Gomez
41|IND|SEMILLA|Raúl Arnulfo Cuá Tumín
42|IND|SEMILLA|Andrea Beatríz Villagrán Antón de Pantoja
43|IND|SEMILLA|Brenda Marleny Mejía López
44|IND|SEMILLA|Elena Sofia Motta Kolleff
45|IND|SEMILLA|Laura Fabiola Marroquín Cordón
46|IND|SEMILLA|Raúl Amilcar Barrera Robles
47|IND|SEMILLA|Román Wilfredo Castellanos Caal
48|IND|SEMILLA|Samuel Andrés Pérez Alvarez
49|IND|SEMILLA|Andrea María Reyes Zeceña
50|IND|BIEN|César Roberto Dávila Córdova
51|IND|SEMILLA|David Mauricio Illescas Sandoval
52|IND|UNE|Ervin Adim Maldonado Molina
53|IND|SEMILLA|Ivanna María Luján Padilla
54|IND|SEMILLA|José Carlos Sanabria Arias
55|IND|VOS|Karina Alexandra Paz Rosales
56|IND|UNE|León Felipe Barrera Villanueva
57|IND|SEMILLA|Luis Antonio Cáceres Gamarro
58|IND|SEMILLA|Mirna Victoria Godoy Palala
59|IND|SEMILLA|Ronalth Ivan Ochaeta Aguilar
60|IND|SEMILLA|Alma Luz Guerrero de la Cruz
61|IND|SEMILLA|Ana Patricia Orantes Thomas
62|IND|SEMILLA|Byron Alesky Obregón Castañeda
63|IND|VIVA|Evelyn Oddeth Morataya Marroquín
64|IND|VIVA|Gustavo Adolfo Crúz Montoya
65|IND|VIVA|Jorge Romeo Castro Delgado
66|IND|SEMILLA|Manfredo Duvalier Castañón González
67|IND|SEMILLA|Olga Isabel Villalta Pereira
68|IND|UNE|César Augusto Fión Morales
69|IND|SEMILLA|José Orlando Pérez Marroquín
70|IND|UNE|José Adolfo Quezada Valdéz
71|IND|UNE|Raúl Antonio Solórzano Quevedo
72|IND|SEMILLA|José Diego Toledo Cruz
73|IND|SEMILLA|Mercedes del Rosario Monzón Escobedo
74|IND|NOSOTROS|Vivian Beatriz Preciado Navarijo
75|IND|VAMOS|Jorge Mario Cabrera Ordóñez
76|UNE|UNE|Oscar Rolando Corleto Rivera
77|UNE|UNE|Victor Hugo Cifuentes Delgado
78|UNE|UNE|Marleni Lineth Matías Santiago
79|UNE|UNE|Mynor Francisco Rivera Salazar
80|UNE|UNE|Ivana Bonilla Oliva
81|UNE|UNE|Julio Daniel Marroquín Ordoñez
82|UNE|UNE|Francisco Vitelio Lam Ruano
83|UNE|UNE|Marco Aurelio Mejía Alfaro
84|UNE|UNE|Karla Betzaida Cardona Arreaga
85|UNE|UNE|Manrique Obel Gálvez De León
86|UNE|UNE|Martín Nicolás Segundo
87|UNE|UNE|Darwin Edgardo Ramírez Cameros
88|UNE|UNE|Dámaris Carolina Cerna Acevedo
89|UNE|UNE|Lourdes Teresita De León Torres
90|UNE|UNE|Luis Javier López Bolaños
91|UNE|UNE|Sergio Guillermo Enriquez Garzaro
92|UNE|UNE|Benjamin Ipiña Leiva
93|UNE|UNE|Rolando Miguel Ovalle Barrios
94|UNE|UNE|Mario Ernesto Gálvez Muñóz
95|UNE|UNE|José Inés Castillo Martínez
96|UNE|UNE|Vasny Adiel Maldonado Alonzo
97|UNE|UNE|Julio Pedro Gómez Gómez
98|CABAL|CABAL|Byron Leonidas Tejeda Marroquín
99|CABAL|CABAL|Pablo Leonel Cifuentes Ovalle
100|CABAL|CABAL|Manuel de Jesús Archila Cordón
101|CABAL|CABAL|Rolando Guzmán Figueroa
102|CABAL|CABAL|Julio César López Escobar
103|CABAL|CABAL|Jairo Danilo Orellana Sandoval
104|CABAL|CABAL|Kevyn Luis Carlo Escobar Castillo
105|CABAL|CABAL|Julio Héctor Estrada Domínguez
106|CABAL|CABAL|Luis Fernando Aguirre Estrada
107|CABAL|CABAL|Nery Mamfredo Rodas Méndez
108|CABAL|CABAL|Carlos Enrique López Maldonado
109|CABAL|CABAL|Marcos Eduardo Tebelán Pantzay
110|CABAL|CABAL|Guillermo Antonio Ralda Conde
111|CABAL|CABAL|Sergio Leonel Celis Navas
112|CABAL|CABAL|Mario Velásquez Pérez
113|CABAL|CABAL|Bequer Neftali Chocooj de la Cruz
114|CABAL|CABAL|Alberto Eduardo De León Benítez
115|CABAL|CABAL|Julio César Portillo Paz
116|VALOR|VALOR|Sandra Erica Jovel Polanco
117|VALOR|VALOR|Elmer Josué Palencia Reyes
118|VALOR|VALOR|Jorge Estuardo Ayala Marroquin
119|VALOR|VALOR|Ernesto Bran Colindres
120|VALOR|VALOR|Mercedes Cristabel Guardado Linares de Nájera
121|VALOR|VALOR|Faver Emilio Salazar Cordero
122|VALOR|VALOR|Gerardín Ariel Díaz Mazariegos
123|VALOR|VALOR|Carlos Enrique López Girón
124|VALOR|VALOR|José Luis Galindo De León
125|VALOR|VALOR|Sherol Ivanisse Arévalo Avila
126|VIVA|VIVA|Fidencio Lima Pop
127|VIVA|VIVA|Víctor Vicente Bonilla González
128|VIVA|VIVA|Obbed Ediberto Castañasa Mendizábal
129|VIVA|VIVA|César Augusto Amézquita Del Valle
130|VIVA|VIVA|Edin Alexander De Jesús Mejía
131|VIVA|VIVA|Nery René Mazariegos López
132|VIVA|VIVA|Jeovanni Omar Dominguez Orozco
133|VIVA|VIVA|Gerson Geovanny Barragán Morales
134|TODOS|TODOS|Cornelio Gonzalo García García
135|TODOS|TODOS|Marvin Adrián Zepeda Zepeda
136|TODOS|TODOS|Felipe Alejos Lorenzana
137|TODOS|TODOS|Byron Bladimiro Rodríguez Palacios
138|TODOS|TODOS|Gustavo Adolfo Cifuentes Navarro
139|TODOS|TODOS|Danilo Madrazo Mazariegos
140|CREO|CREO|Cristian Rodolfo Alvarez y Alvarez
141|CREO|CREO|José Pablo Mendoza Franco
142|CREO|CREO|Luis Alberto Contreras Colíndres
143|BIEN|BIEN|Lucrecia Carola Samayoa Reyes
144|BIEN|BIEN|Fidel Reyes Lee
145|BIEN|BIEN|Sabino Sebastián Velásquez Bámaca
146|VOS|VOS|José Alberto Chic Cardona
147|VOS|VOS|Jairo Joaquín Flores Divas
148|VOS|VOS|Orlando Joaquín Blanco Lapola
149|PU|PU|Alvaro Enrique Arzú Escobar
150|PU|PU|Ana Lucrecia Marroquín Godoy de Palomo
151|ELEFANTE|ELEFANTE|Hellen Magaly Alexándra Ajcip Canel
152|ELEFANTE|ELEFANTE|Rodrigo Antonio Pellecer Rodriguez
153|AZUL|AZUL|Nery Abilio Ramos y Ramos
154|AZUL|AZUL|Jorge Mario Villagrán Alvarez
155|VICTORIA|VICTORIA|Randy Araely Coc Figueroa
156|VICTORIA|VICTORIA|Juan Carlos Rivera Estevez
157|CAMBIO|CAMBIO|Esduín Jerson Javier Javier
158|NOSOTROS|NOSOTROS|Nadia Lorena De León Torres
159|WINAQ-URNG-MAIZ|WINAQ-URNG-MAIZ|Sonia Marina Gutierrez Raguay
`;

export const NOMBRES = {
  VAMOS: "Vamos",
  IND: "Independientes",
  UNE: "UNE",
  SEMILLA: "Semilla",
  CABAL: "Cabal",
  VALOR: "Valor",
  VIVA: "Viva",
  TODOS: "Todos",
  CREO: "CREO",
  BIEN: "Bien",
  VOS: "VOS",
  PU: "Unionista",
  ELEFANTE: "Elefante",
  AZUL: "Azul",
  VICTORIA: "Victoria",
  CAMBIO: "Cambio",
  NOSOTROS: "Nosotros",
  "WINAQ-URNG-MAIZ": "Winaq-URNG",
};

export const DIPUTADOS = ROWS.trim()
  .split("\n")
  .map((row) => {
    const [posicion, bloque, partido, nombre] = row.split("|");
    return { posicion: Number(posicion), bloque, partido, nombre };
  })
  .sort((a, b) => a.posicion - b.posicion);

export const BLOQUES = [];
for (const [index, diputado] of DIPUTADOS.entries()) {
  let bloque = BLOQUES.find((entry) => entry.id === diputado.bloque);
  if (!bloque) {
    bloque = { id: diputado.bloque, nombre: NOMBRES[diputado.bloque] ?? diputado.bloque, curules: [] };
    BLOQUES.push(bloque);
  }
  bloque.curules.push(index);
}

export const TOTAL = DIPUTADOS.length;
export const MAYORIA = Math.floor(TOTAL / 2) + 1;
export const DOS_TERCIOS = Math.ceil((TOTAL * 2) / 3);
export const LEIDO = "12 de octubre de 2026";
