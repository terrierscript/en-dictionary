const datastore = {
    index: [],
    data: []
}

const dictionary = {
    isReady: false,

    addIndex: (index) => {
        datastore.index.push(index)
        return dictionary.getDatastoreSize()
    },

    addData: (data) => {
        datastore.data.push(data)
        return dictionary.getDatastoreSize()
    },

    getDatastoreSize: () => {
        return datastore.index.length + datastore.data.length
    },

    readComplete: () => {
        dictionary.isReady = true
    },

    query: (search) => {
        if (!dictionary.isReady) {
            return new Error('Dictionary is not ready to query yet')
        }

        const output = {}

        // Get results from index
        const indexResult = dictionary.indexSearch(search)
        const firstResult = Object.keys(indexResult)[0]
        output.word = indexResult[firstResult].lemma
        output.pos = indexResult[firstResult].pos
        output.offsets = indexResult[firstResult].offsets
        output.synsets = {}

        // Get results from data
        const linkedSynsets = []
        const dataResults = dictionary.dataSearch(indexResult[firstResult].offsets)
        indexResult[firstResult].offsets.forEach((synset) => {
            const item = dataResults[synset]
            const op = {}
            op.offset = item.offset
            op.pos = item.pos
            op.words = []
            item.words.forEach(word => op.words.push(word.word))
            op.glossary = item.glossary
            op.linked = {}
            item.pointers.forEach(i => {
                linkedSynsets.push(i.offset)
                op.linked[i.offset] = { why: i.pointerSymbol, offset: i.offset }
            })
            output.synsets[synset] = op
        })

        // Get results from linked words
        const linkedResults = dictionary.dataSearch(linkedSynsets)
        Object.keys(output.synsets).forEach((synset) => {
            Object.keys(output.synsets[synset].linked).forEach((linked) => {
                const linkedData = linkedResults[linked]
                output.synsets[synset].linked[linked].pos = linkedData.pos
                output.synsets[synset].linked[linked].words = []
                linkedData.words.forEach((w) => {
                    output.synsets[synset].linked[linked].words.push(w.word)
                })
                output.synsets[synset].linked[linked].glossary = linkedData.glossary
            })
        })    

        return output
    },

    querySynsets: (search) => {
        if (!dictionary.isReady) {
            return new Error('Dictionary is not ready to query yet')
        }

        const output = {}
        const dataSynsetQuery = []
        // Get results from index
        const indexResult = dictionary.indexSearch(search, 'synset')
        Object.keys(indexResult).forEach((item) => {
            output[indexResult[item].lemma] = {
                word: indexResult[item].lemma,
                pos: indexResult[item].pos,
                offsets: indexResult[item].offsets
            }
            dataSynsetQuery.push(...indexResult[item].offsets)
        })

        // Get results from data
        // const linkedSynsets = []
        // const dataResults = dictionary.dataSearch(dataSynsetQuery)
        // indexResult[firstResult].offsets.forEach((synset) => {
        //     const item = dataResults[synset]
        //     const op = {}
        //     op.offset = item.offset
        //     op.pos = item.pos
        //     op.words = []
        //     item.words.forEach(word => op.words.push(word.word))
        //     op.glossary = item.glossary
        //     op.linked = {}
        //     item.pointers.forEach(i => {
        //         linkedSynsets.push(i.offset)
        //         op.linked[i.offset] = { why: i.pointerSymbol, offset: i.offset }
        //     })
        //     output.synsets[synset] = op
        // })

        return output
    },

    startsWith: (query) => {
        const output = []
        const filtered = dictionary.filter('index', (item) => {
            return !item.isComment && (item.lemma.startsWith(query))
        })
        Object.keys(filtered).forEach((item) => {
            output.push(filtered[item].lemma)
        })
        return output
    },

    endsWith: (query) => {
        const output = []
        const filtered = dictionary.filter('index', (item) => {
            return !item.isComment && (item.lemma.endsWith(query))
        })
        Object.keys(filtered).forEach((item) => {
            output.push(filtered[item].lemma)
        })
        return output
    },

    includes: (query) => {
        const output = []
        const filtered = dictionary.filter('index', (item) => {
            return !item.isComment && (item.lemma.includes(query))
        })
        Object.keys(filtered).forEach((item) => {
            output.push(filtered[item].lemma)
        })
        return output
    },

    withEachCharIn: (query) => {
        const output = []
        const filtered = dictionary.filter('index', (item) => {
            if (item.isComment) {
                return false
            }

            const lemmaSplit = item.lemma.split('').sort()
            const querySplit = query.split('').sort()

            for (let i = 0; i < querySplit.length; i += 1) {
                const char = querySplit[i]
                const found = lemmaSplit.indexOf(char)
                if (found < 0) {
                    return false
                }

                lemmaSplit.splice(found, 1)
            }
            return true
        })
        Object.keys(filtered).forEach((item) => {
            output.push(filtered[item].lemma)
        })
        return output
    },

    withCharsIn: (query, minLength = 0) => {
        const output = []
        const filtered = dictionary.filter('index', (item) => {
            if (item.isComment) {
                return false
            }

            const lemmaSplit = item.lemma.split('').sort()
            const querySplit = query.split('').sort()

            if (lemmaSplit.length < minLength) {
                return false
            }

            if (lemmaSplit.length > querySplit.length) {
                return false
            }

            for (let i = 0; i < lemmaSplit.length; i += 1) {
                const char = lemmaSplit[i]
                const foundQuery = querySplit.indexOf(char)
                if (foundQuery < 0) {
                    return false
                }

                querySplit.splice(foundQuery, 1)
            }
            return true
        })
        Object.keys(filtered).forEach((item) => {
            output.push(filtered[item].lemma)
        })
        return output.sort((a, b) => {
            return b.length - a.length
        })
    },

    indexSearch: (query, type) => {
        const filtered = dictionary.filter('index', (item) => {
            if (type === 'synset') {
                return !item.isComment && (item.offsets.includes(query))
            }
            return !item.isComment && (item.lemma === query)
        })
        if (Object.keys(filtered).length > 0) {
            return filtered
        }
        return new Error('Word not found in index')
    },

    dataSearch: (query) => {
        const filtered = dictionary.filter('data', (item) => {
            return !item.isComment && (query.includes(item.offset))
        })
        if (Object.keys(filtered).length > 0) {
            return filtered
        }
        return new Error('Word not found in data')
    },

    filter: (fileType, filterFunc) => {
        const results = {}
        if (fileType === 'index') {
            datastore.index.filter(filterFunc).forEach((set) => {
                results[set.lemma] = set
            })
        } else {
            datastore.data.filter(filterFunc).forEach((set) => {
                results[set.offset] = set
            })
        }
        return results
    }
    
}

module.exports = dictionary