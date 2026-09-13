import { DataPage } from '@/components/data-page'
export default function Lanes(){return <DataPage resource="lanes" title="Lanes" description="Track contracted capacity against actual movement across every freight lane." columns={['Lane','Mode','Contracted','Actual','Realization','Risk']}/>}
