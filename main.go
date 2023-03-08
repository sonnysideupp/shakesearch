package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"index/suffixarray"
	"io/ioutil"
	"log"
	"math"
	"math/rand"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
)

func main() {
	searcher := Searcher{}
	err := searcher.Load("completeworks.txt")
	if err != nil {
		log.Fatal(err)
	}

	fs := http.FileServer(http.Dir("./static"))
	http.Handle("/", fs)

	http.HandleFunc("/search", handleSearch(searcher))

	port := os.Getenv("PORT")
	if port == "" {
		port = "3001"
	}

	fmt.Printf("Listening on port %s...", port)
	err = http.ListenAndServe(fmt.Sprintf(":%s", port), nil)
	if err != nil {
		log.Fatal(err)
	}
}

type Searcher struct {
	WordsList     []string
	CompleteWorks string
	SuffixArray   *suffixarray.Index
}

func handleSearch(searcher Searcher) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		query, ok := r.URL.Query()["q"]

		queryMulti, okMulti := r.URL.Query()["multi"]

		queryFuzzy, okFuzzy := r.URL.Query()["fuzzy"]

		if !ok || len(query[0]) < 1 {
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte("missing search query in URL params"))
			return
		}

		if !okMulti || len(queryMulti[0]) < 1 {
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte("missing search query in URL params"))
			return
		}

		if !okFuzzy || len(queryFuzzy[0]) < 1 {
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte("missing search query in URL params"))
			return
		}

		multiWord, _ := strconv.ParseBool(queryMulti[0])

		fuzzyWord, _ := strconv.ParseBool(queryFuzzy[0])

		// splitting query string into an array of queries for handling multiple words
		queryArray := []string{query[0]}

		if multiWord {

			queryArray = strings.Fields(query[0])
		}

		results := []string{}

		if fuzzyWord {
			results = searcher.SearchFuzzy(queryArray)

		} else {
			results = searcher.Search(queryArray)
		}
		buf := &bytes.Buffer{}
		enc := json.NewEncoder(buf)
		err := enc.Encode(results)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte("encoding failure"))
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(buf.Bytes())
	}
}

func (s *Searcher) Load(filename string) error {

	file, err := os.Open(filename)
	if err != nil {
		log.Fatal(err)
	}

	Scanner := bufio.NewScanner(file)
	Scanner.Split(bufio.ScanWords)
	words := []string{}
	for Scanner.Scan() {

		words = append(words, Scanner.Text())

	}
	if err := Scanner.Err(); err != nil {
		log.Fatal(err)
	}
	s.WordsList = words

	dat, err := ioutil.ReadFile(filename)
	if err != nil {
		return fmt.Errorf("Load: %w", err)
	}
	s.CompleteWorks = string(dat)
	s.SuffixArray = suffixarray.New(bytes.ToLower(dat))
	return nil

}

func levenshteinDistance(s, t string) int {
	r1, r2 := []rune(s), []rune(t)
	column := make([]int, 1, 64)

	for y := 1; y <= len(r1); y++ {
		column = append(column, y)
	}

	for x := 1; x <= len(r2); x++ {
		column[0] = x

		for y, lastDiag := 1, x-1; y <= len(r1); y++ {
			oldDiag := column[y]
			cost := 0
			if r1[y-1] != r2[x-1] {
				cost = 1
			}
			column[y] = min(column[y]+1, column[y-1]+1, lastDiag+cost)
			lastDiag = oldDiag
		}
	}

	return column[len(r1)]
}

func min(a, b, c int) int {
	if a < b && a < c {
		return a
	} else if b < c {
		return b
	}
	return c
}

func isSimilar(query, word string) bool {

	nonAlphanumericRegex := regexp.MustCompile(`[\W_]+`)

	// removing special char like ! , . from the string
	cleanString := nonAlphanumericRegex.ReplaceAllString(word, "")

	if int(math.Abs(float64(len(cleanString)-len(query)))) > 2 {

		return false
	}

	distanceThreshold := 0

	// setting threshold for matching string based on length of the query

	if len(query) >= 3 {
		distanceThreshold = 1

	}
	if len(query) >= 7 {
		distanceThreshold = 2

	}
	if len(query) >= 9 {
		distanceThreshold = 3
	}

	result := levenshteinDistance(query, cleanString)

	return result <= distanceThreshold

}

func getSimilarWordsIndex(query string, words []string) []int {

	indices := []int{}

	for index, word := range words {
		lowerCased := strings.ToLower(word)
		if isSimilar(query, lowerCased) {

			indices = append(indices, index)

			if (len(indices) > 500){

				return indices
			}
		}

	}

	return indices

}

func (s *Searcher) Search(queries []string) []string {

	results := []string{}

	// fmt.Printf("Search")
	// fmt.Printf("%v", queries)
	for _, query := range queries {

		lowercase := strings.ToLower(query)
		idxs := s.SuffixArray.Lookup([]byte(lowercase), -1)

		if len(idxs) > 500 {

			idxs = idxs[:500]
		}

		for _, idx := range idxs {

			endIndex := idx + 250

			// prevent accessing index out of range
			if endIndex >= len(s.CompleteWorks) {
				endIndex = len(s.CompleteWorks) - 1

			}

			startIndex := idx - 250
			// prevent accessing index out of range
			if startIndex < 0 {

				startIndex = 0
			}

			results = append(results, s.CompleteWorks[startIndex:endIndex])
		}

	}
	// shuffling the resulting array so the results are presented more randomly for when there are more than 2 queries
	if len(queries) > 1 {
		rand.Shuffle(len(results), func(i, j int) {
			results[i], results[j] = results[j], results[i]
		})
	}
	return results
}

func (s *Searcher) SearchFuzzy(queries []string) []string {

	results := []string{}

	wordArray := s.WordsList

	for _, query := range queries {
		lowercase := strings.ToLower(query)

		idxs := getSimilarWordsIndex(lowercase, wordArray)
		if len(idxs) > 500 {

			idxs = idxs[:500]
		}
		for _, idx := range idxs {
			//fmt.Printf(string(idx))

			endIndex := idx + 35

			// prevent accessing index out of range
			if endIndex >= len(wordArray) {
				endIndex = len(wordArray) - 1

			}

			startIndex := idx - 35
			// prevent accessing index out of range
			if startIndex < 0 {

				startIndex = 0
			}
			result := strings.Join(wordArray[startIndex:endIndex], " ")
			results = append(results, result)
		}
	}

	// shuffling the resulting array so the results are presented more randomly for when there are more than 2 queries
	if len(queries) > 1 {
		rand.Shuffle(len(results), func(i, j int) {
			results[i], results[j] = results[j], results[i]
		})
	}
	return results
}
