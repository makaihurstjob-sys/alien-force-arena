import {defineConfig,mergeConfig} from 'vite';
import base from './vite.config';
export default mergeConfig(base,defineConfig({plugins:[{name:'campaign-test-observer',enforce:'pre',transform(code,id){
 if(id.split('?')[0]?.endsWith('/src/components/Classic.tsx'))return code.replace('const records = useClassicRecords(game);','(window as any).__campaign = game; const records = useClassicRecords(game);');
 return null;
}}]}));
