'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Check, ChevronLeft, ChevronRight, Wallet, Upload, AlertCircle } from 'lucide-react';

const steps = [
  { id: 1, name: 'General', description: 'Basic project info' },
  { id: 2, name: 'Details', description: 'Token & sale details' },
  { id: 3, name: 'Team', description: 'Team information' },
  { id: 4, name: 'Links', description: 'Social & resources' },
  { id: 5, name: 'Payment', description: 'Listing fee' },
];

const categories = ['DeFi', 'Gaming', 'AI', 'NFT', 'Social', 'Infrastructure', 'DAO', 'Other'];

export default function SubmitProjectPage() {
  const { isConnected } = useAccount();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    // General
    name: '',
    symbol: '',
    description: '',
    category: '',
    // Details
    chain: 'Base',
    totalSupply: '',
    hardCap: '',
    startDate: '',
    endDate: '',
    // Team
    teamMembers: [{ name: '', role: '', linkedin: '' }],
    // Links
    website: '',
    whitepaper: '',
    twitter: '',
    telegram: '',
    discord: '',
    github: '',
    // Payment
    listingTier: 'basic',
  });

  const updateFormData = (field: string, value: string | object[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const addTeamMember = () => {
    setFormData((prev) => ({
      ...prev,
      teamMembers: [...prev.teamMembers, { name: '', role: '', linkedin: '' }],
    }));
  };

  const updateTeamMember = (index: number, field: string, value: string) => {
    const updated = [...formData.teamMembers];
    updated[index] = { ...updated[index], [field]: value };
    updateFormData('teamMembers', updated);
  };

  const nextStep = () => setCurrentStep((prev) => Math.min(prev + 1, 5));
  const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 1));

  const listingTiers = [
    { id: 'basic', name: 'Basic Listing', price: '0.01 ETH', features: ['Standard visibility', 'Community voting', 'Basic support'] },
    { id: 'bronze', name: 'Bronze', price: '0.05 ETH', features: ['1 day featured', 'Bronze badge', 'Priority support'] },
    { id: 'silver', name: 'Silver', price: '0.12 ETH', features: ['3 days featured', 'Silver badge', 'Social promotion'] },
    { id: 'gold', name: 'Gold', price: '0.25 ETH', features: ['7 days featured', 'Gold badge', 'Newsletter feature'] },
  ];

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Wallet className="h-16 w-16 text-gray-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Connect Your Wallet</h1>
          <p className="text-gray-400 mb-6">You need to connect your wallet to submit a project</p>
          <ConnectButton />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-center mb-2">Submit Your Project</h1>
        <p className="text-gray-400 text-center mb-8">
          Get your project listed on ICOTrust and reach thousands of investors
        </p>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                      currentStep > step.id
                        ? 'bg-green-500 text-white'
                        : currentStep === step.id
                        ? 'bg-yellow-500 text-black'
                        : 'bg-gray-700 text-gray-400'
                    }`}
                  >
                    {currentStep > step.id ? <Check className="h-5 w-5" /> : step.id}
                  </div>
                  <span className="text-xs mt-1 text-gray-400 hidden sm:block">{step.name}</span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`w-12 sm:w-20 h-1 mx-2 ${
                      currentStep > step.id ? 'bg-green-500' : 'bg-gray-700'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Form */}
        <div className="bg-gray-800 rounded-xl p-6">
          {/* Step 1: General */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold">General Information</h2>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Project Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => updateFormData('name', e.target.value)}
                  placeholder="e.g., DeFi Protocol X"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Token Symbol *</label>
                <input
                  type="text"
                  value={formData.symbol}
                  onChange={(e) => updateFormData('symbol', e.target.value.toUpperCase())}
                  placeholder="e.g., DPX"
                  maxLength={10}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Category *</label>
                <select
                  value={formData.category}
                  onChange={(e) => updateFormData('category', e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none"
                >
                  <option value="">Select a category</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Description *</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => updateFormData('description', e.target.value)}
                  placeholder="Describe your project..."
                  rows={4}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none resize-none"
                />
              </div>
            </div>
          )}

          {/* Step 2: Details */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold">Token & Sale Details</h2>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Blockchain</label>
                <select
                  value={formData.chain}
                  onChange={(e) => updateFormData('chain', e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none"
                >
                  <option value="Base">Base</option>
                  <option value="Ethereum">Ethereum</option>
                  <option value="Arbitrum">Arbitrum</option>
                  <option value="Optimism">Optimism</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Total Supply</label>
                  <input
                    type="text"
                    value={formData.totalSupply}
                    onChange={(e) => updateFormData('totalSupply', e.target.value)}
                    placeholder="e.g., 100,000,000"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Hard Cap (USD)</label>
                  <input
                    type="text"
                    value={formData.hardCap}
                    onChange={(e) => updateFormData('hardCap', e.target.value)}
                    placeholder="e.g., 2,000,000"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Sale Start Date</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => updateFormData('startDate', e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Sale End Date</label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => updateFormData('endDate', e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Team */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold">Team Information</h2>

              {formData.teamMembers.map((member, index) => (
                <div key={index} className="p-4 bg-gray-700 rounded-lg space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Team Member {index + 1}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      type="text"
                      value={member.name}
                      onChange={(e) => updateTeamMember(index, 'name', e.target.value)}
                      placeholder="Name"
                      className="w-full bg-gray-600 border border-gray-500 rounded-lg px-4 py-2 focus:border-yellow-500 focus:outline-none"
                    />
                    <input
                      type="text"
                      value={member.role}
                      onChange={(e) => updateTeamMember(index, 'role', e.target.value)}
                      placeholder="Role"
                      className="w-full bg-gray-600 border border-gray-500 rounded-lg px-4 py-2 focus:border-yellow-500 focus:outline-none"
                    />
                  </div>
                  <input
                    type="text"
                    value={member.linkedin}
                    onChange={(e) => updateTeamMember(index, 'linkedin', e.target.value)}
                    placeholder="LinkedIn URL"
                    className="w-full bg-gray-600 border border-gray-500 rounded-lg px-4 py-2 focus:border-yellow-500 focus:outline-none"
                  />
                </div>
              ))}

              <button
                onClick={addTeamMember}
                className="w-full py-3 border border-dashed border-gray-600 rounded-lg text-gray-400 hover:border-yellow-500 hover:text-yellow-500 transition-colors"
              >
                + Add Team Member
              </button>
            </div>
          )}

          {/* Step 4: Links */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold">Links & Resources</h2>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Website *</label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => updateFormData('website', e.target.value)}
                  placeholder="https://yourproject.com"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Whitepaper</label>
                <input
                  type="url"
                  value={formData.whitepaper}
                  onChange={(e) => updateFormData('whitepaper', e.target.value)}
                  placeholder="https://yourproject.com/whitepaper.pdf"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Twitter</label>
                  <input
                    type="url"
                    value={formData.twitter}
                    onChange={(e) => updateFormData('twitter', e.target.value)}
                    placeholder="https://twitter.com/..."
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Telegram</label>
                  <input
                    type="url"
                    value={formData.telegram}
                    onChange={(e) => updateFormData('telegram', e.target.value)}
                    placeholder="https://t.me/..."
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Payment */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold">Select Listing Package</h2>

              <div className="grid grid-cols-2 gap-4">
                {listingTiers.map((tier) => (
                  <div
                    key={tier.id}
                    onClick={() => updateFormData('listingTier', tier.id)}
                    className={`p-4 rounded-lg cursor-pointer border-2 transition-all ${
                      formData.listingTier === tier.id
                        ? 'border-yellow-500 bg-yellow-500/10'
                        : 'border-gray-600 hover:border-gray-500'
                    }`}
                  >
                    <div className="font-bold mb-1">{tier.name}</div>
                    <div className="text-xl text-yellow-500 mb-3">{tier.price}</div>
                    <ul className="text-sm text-gray-400 space-y-1">
                      {tier.features.map((f) => (
                        <li key={f} className="flex items-center">
                          <Check className="h-4 w-4 text-green-500 mr-1" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-yellow-500/10 border border-yellow-500/50 rounded-lg">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-yellow-500">Payment Required</p>
                    <p className="text-gray-400">
                      Your listing will be submitted for review after payment. We accept ETH on Base.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8 pt-6 border-t border-gray-700">
            <button
              onClick={prevStep}
              disabled={currentStep === 1}
              className="flex items-center space-x-2 px-6 py-3 border border-gray-600 rounded-lg hover:border-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
              <span>Back</span>
            </button>

            {currentStep < 5 ? (
              <button
                onClick={nextStep}
                className="flex items-center space-x-2 px-6 py-3 bg-yellow-500 text-black font-semibold rounded-lg hover:bg-yellow-400 transition-colors"
              >
                <span>Continue</span>
                <ChevronRight className="h-5 w-5" />
              </button>
            ) : (
              <button className="flex items-center space-x-2 px-6 py-3 bg-yellow-500 text-black font-semibold rounded-lg hover:bg-yellow-400 transition-colors">
                <span>Submit & Pay</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
