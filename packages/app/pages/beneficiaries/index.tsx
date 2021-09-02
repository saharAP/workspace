import {
  BeneficiaryApplication,
  BeneficiaryRegistryAdapter,
} from '@popcorn/contracts/adapters';
import { IpfsClient } from '@popcorn/utils';
import BeneficiaryGrid from 'components/Beneficiaries/BeneficiaryGrid';
import { useContext, useEffect, useState } from 'react';
import { ContractsContext } from '../../context/Web3/contracts';

export default function BeneficiaryPage(): JSX.Element {
  const { contracts } = useContext(ContractsContext);
  const [beneficiaries, setBeneficiaries] = useState<BeneficiaryApplication[]>(
    [],
  );
  useEffect(() => {
    if (contracts) {
      BeneficiaryRegistryAdapter(contracts.beneficiary, IpfsClient)
        .getAllBeneficiaryApplications()
        .then((beneficiaries) => setBeneficiaries(beneficiaries));
    }
  }, [contracts]);
  return (
    <BeneficiaryGrid
      title={'Eligible Beneficiaries'}
      subtitle={
        'Beneficiary organizations that have passed the voting process and are eligible to receive grants'
      }
      beneficiaries={beneficiaries}
    />
  );
}
