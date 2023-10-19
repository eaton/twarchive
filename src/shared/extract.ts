import winkNLP from 'wink-nlp';
import model from 'wink-eng-lite-web-model';

const nlp = winkNLP(model);
const its = nlp.its;

/**  
 * Tools for extracting data from unstrctured or semi-structured text and markup.
 */

export function findTopics(input: string) {
  const doc = nlp.readDoc(input);
  console.log(doc.out(its.readabilityStats));
}