import React from 'react';
import Layout from '../components/Layout';

export default function DeploymentTest() {
  return (
    <Layout>
      <div className="max-w-4xl mx-auto my-8 px-4">
        <h1 className="text-3xl font-bold mb-4">Deployment Test Page</h1>
        <p className="mb-4">
          This page was created to verify that deployments are working correctly.
        </p>
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          If you can see this page with this message, it means your deployment of {new Date().toLocaleString()} is working!
        </div>
      </div>
    </Layout>
  );
} 