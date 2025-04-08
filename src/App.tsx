import React from 'react';
import ProductList from './components/ProductList';

const App: React.FC = () => {
    return (
        <div style={{ padding: '2rem', fontFamily: 'Arial' }}>
            <h1>Catálogo de Productos</h1>
            <ProductList />
        </div>
    );
};

export default App;
