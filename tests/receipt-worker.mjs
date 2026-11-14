import {appendFile} from 'node:fs/promises';
import {join} from 'node:path';
import {Store} from '../lib/store.js';
const root=process.argv[2];
process.send({ready:true});
process.once('message',async()=>{
  try{const result=await new Store(root).once('2027-05-06',async()=>{await appendFile(join(root,'deliveries.txt'),'delivered\n');return {delivered:true};});process.send({result});}
  catch(error){process.send({busy:true});}
  finally{process.disconnect();}
});
