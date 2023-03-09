'use strict';
const e = React.createElement;

const Loader = () => {

	return e(`img`, {src: "/spinner.svg", className: "h-5 w-5 ml-2.5 mr-2.5 animate-spin"}
	,)

}


const SearchButton = () => {
	return e(`button`, {form: "form", name: "query", id: "query", className: "bg-blue-400 hover:bg-blue-500 text-white py-2 px-6 rounded-full", type: "submit"}, "Search")
	
}

const IconButton = ({src, onClick, className}) => {


	return e('button', {onClick: onClick, className: className}, e(`img`, {src: src, className: "h-6 w-6"}))
}

const Input = ({value, setValue, searching}) => {


	
	return e(`input`, {disabled: searching, name: "query",spellCheck: true, required: true, value: value, onChange: (event) => {setValue(event.target.value)}, placeholder: "Search...",className:"border-none outline-none py-2 w-64 ", type:"text"}, null)
}

const CheckBoxContainer = ({setEnableMultiWord, enableMultiWord, enableFuzzySearch, setEnableFuzzySearch}) => {




	return e('div', {className: "flex flex-row items-center font-regular text-slate-500 mt-2"}, e(CheckBoxFuzzySearch, {setEnableFuzzySearch, enableFuzzySearch}), "Enable fuzzy-word search (slow)", e(CheckBoxMultiWord, {setEnableMultiWord, enableMultiWord}), "Enable multi-word search")


}


const CheckBoxMultiWord = ({enableMultiWord, setEnableMultiWord}) => {

	const onChange = (event) => {

		setEnableMultiWord(event.target.checked)
	}
	return e('input', {type: "checkbox", checked: enableMultiWord, className: "ml-2 mr-2", onChange: onChange})
}


const CheckBoxFuzzySearch = ({enableFuzzySearch, setEnableFuzzySearch}) => {

	const onChange = (event) => {

		setEnableFuzzySearch(event.target.checked)
	}
	return e('input', {type: "checkbox", checked: enableFuzzySearch, className: "ml-2 mr-2", onChange: onChange})
}



const SearchBox = ({searching, setSearchResults}) => {
	const[value, setValue] = React.useState("")

	const clearText = () => {
		setValue("")
		setSearchResults(null)
	}
	return e(
		`div`,
		{ className: "flex flex-row border-solid items-center border-2 border-slate-300 rounded mr-4 relative"},
		e(`img`, {src: "/icons/searchIcon.svg", className: "h-6 w-6 ml-3 mr-2"}) , 
		e(Input,{value, setValue, searching}),
		searching ? e(Loader) : value ? e(IconButton, {src: "/icons/xmarkIcon.svg", className: "h-6 w-6 ml-2 mr-2", onClick: clearText}) : e(`div`, {className: "h-6 w-6 mr-2 ml-2"})
	  )
}


const SearchContainer = ({setSearchResults, searching}) => {


	return e(`div`, {className: "flex flex-row items-center"}, e(SearchBox, {searching: searching, setSearchResults}), e(SearchButton))
}


const SearchResultsTable = ({results}) => {


	console.log("reuslts")
	console.log(results)
	return e(`div`, {className: "w-screen flex flex-col items-center mt-10", dangerouslySetInnerHTML: {__html: results ? results.join(" ") : ""}}
		
	)
}


const SearchResultsLoader = () => {


	return e('div')
}

const levenshteinDistance = (s, t) => {
	if (!s.length) return t.length;
	if (!t.length) return s.length;
	const arr = [];
	for (let i = 0; i <= t.length; i++) {
	  arr[i] = [i];
	  for (let j = 1; j <= s.length; j++) {
		arr[i][j] =
		  i === 0
			? j
			: Math.min(
				arr[i - 1][j] + 1,
				arr[i][j - 1] + 1,
				arr[i - 1][j - 1] + (s[j - 1] === t[i - 1] ? 0 : 1)
			  );
	  }
	}
	return arr[t.length][s.length];
  };

  const isSimilar = (query, word) => {

	let distanceThreshold = 0

	// setting threshold for matching string based on length of the query 

	if (query.length >= 3) {
		distanceThreshold = 1

	}
	if (query.length >= 7) {
		distanceThreshold = 2

	}
	if (query.length >= 9) {
		distanceThreshold = 3
	}


	return levenshteinDistance(query, word) <= distanceThreshold

}



const shouldBeHighlighted = (queries, str2) => {


	for (let query of queries){
		// getting rid of special characters like ! . ,
		let reformattedQuery = query.toLowerCase().replace(/[\W_]+/g, '')

		let reformattedString = str2.toLowerCase().replace(/[\W_]+/g, '')

		if (reformattedQuery == reformattedString) return true 

		// check for text similarity using edit (levenshtein) distance for fuzzy search
		
		if (isSimilar(reformattedQuery, reformattedString)){
			return true
		}

	}



	return false 

}

String.prototype.replaceAll = function(queries, strWith) {
    // See http://stackoverflow.com/a/3561711/556609

	let regExpressions = []
	for (const query of queries){
		var esc = query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
		regExpressions.push(esc)
	}
    
    var reg = new RegExp(regExpressions.join("|"), 'ig');
    return this.replace(reg, strWith);
};

const formContainer = () => {

	const[searching, setSearching] = React.useState(false)

	const [searchResults, setSearchResults] = React.useState(null)

	const [enableMultiWord, setEnableMultiWord] = React.useState(true)

	const [enableFuzzySearch, setEnableFuzzySearch] = React.useState(false)

	let controller = null
    

	const updateTable =  (results, query) => {

    const rows = [];

	
    for (let result of results) {

	 let highlightedResult 
	  if (enableFuzzySearch){

	  // breaking string into individual words and checking if each word should be highlighted
	  let stringArray = result.split(" ")

	  stringArray = stringArray.map((word) => {

		let shouldHighlight = shouldBeHighlighted(query.split(" "), word)
	
		return shouldHighlight ? `<mark class="bg-yellow-300 tracking-tighter">${word}</mark>` : word

	  })
	 
	 highlightedResult = stringArray.join(" ")
	 highlightedResult = highlightedResult.replace(/\n/g,"<br />")
	}else{

		highlightedResult = result.replaceAll(enableMultiWord ? query.split(" ") : [query], (originalText) => `<mark class="bg-yellow-300 tracking-tighter">${originalText}</mark>`)

		highlightedResult = highlightedResult.replace(/\n/g,"<br />")
	}
	  
      rows.push( `<div class="p-5 w-1/2" >  ${highlightedResult}</div>` );
	  rows.push(`<div class="border-t-2 border-slate-500 w-1/2"> </div>`)
    }
	


	setSearchResults(rows)
   

	
  }

  const abortFetching = () => {
	console.log('Now aborting');
	// Abort.
	controller.abort()
}


const onSubmit = async (ev) => {

	try{
	
		ev.preventDefault();
		if (controller) abortFetching()

		controller = new AbortController();
		const signal = controller.signal
		setSearching(true)
		setSearchResults(null)
		console.log("searchResults")
		console.log(searchResults)

	
		const form = document.getElementById("form");
		const data = Object.fromEntries(new FormData(form));

		fetch(`/search?q=${data.query}&multi=${enableMultiWord}&fuzzy=${enableFuzzySearch}`, {
                method: 'get',
                signal: signal,
            }).then( async response => {
		
		controller = null
		const results = await response.json()
		
	
		
		updateTable(results, data.query);
		setSearching(false)
	

	
		}).catch(error => {
			console.log("fetch error")
			console.log(error)
			setSearching(false)
		})
	  }catch(error){

		console.log(error)
		setSearching(false)
	  }
	}

	return e(`form`, {onSubmit: onSubmit, className: "w-full flex flex-col items-center justify-around", id: "form"}, e(SearchContainer, { searching, setSearchResults}), e(CheckBoxContainer, {setEnableFuzzySearch, enableFuzzySearch, setEnableMultiWord, enableMultiWord}), searchResults ?  searchResults.length == 0 ? e('div', {className: 'text-slate-500 mt-8 text-2xl'}, "No matching results") :  e(SearchResultsTable, {results: searchResults}) : null )
}


const domContainer = document.querySelector('#form_container');
const root = ReactDOM.createRoot(domContainer);
root.render(e(formContainer));