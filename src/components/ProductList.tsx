import React, { useEffect, useState } from 'react';
import { fetchProducts, Product } from '../services/api';

const ProductList: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([]);

    useEffect(() => {
        fetchProducts().then(setProducts);
    }, []);

    return (
        <div>
            {products.length === 0 ? (
                <p>No hay productos disponibles.</p>
            ) : (
                <ul>
                    {products.map((product) => (
                        <li key={product.id}>
                            <strong>{product.name}</strong>: ${product.price}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default ProductList;
