import { FormStepProps } from 'pages/proposals/propose';
import web3 from 'web3';
import ContinueButton from './ContinueButton';
import ControlledTextInput from './ControlledTextInput';

const BeneficiaryAddress: React.FC<FormStepProps> = ({
  form,
  navigation,
  visible,
}) => {
  const [formData, setFormData] = form;
  function updateEthereumAddress(beneficiaryAddress: string): void {
    setFormData({ ...formData, beneficiaryAddress });
  }

  return (
    visible && (
      <div className="mx-auto content-center justify-items-center">

        <h2 className="justify-self-center text-base text-indigo-600 font-semibold tracking-wide">
          {navigation.currentStep} - What's the Ethereum address grants will be sent to?
        </h2>
        <ControlledTextInput
          inputValue={formData.beneficiaryAddress}
          id="ethereumAddress"
          placeholder="Ethererum Address"
          errorMessage="Please enter a valid ethereum address"
          updateInput={updateEthereumAddress}
          isValid={web3.utils.isAddress}
        />
        {web3.utils.isAddress(formData?.beneficiaryAddress) && (
          <ContinueButton navigation={navigation} />
        )}
      </div>
    )
  );
};
export default BeneficiaryAddress;
