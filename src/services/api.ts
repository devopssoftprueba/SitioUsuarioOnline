export interface Product {
    id: number;
    name: string;
    price: number;
}

export async function fetchProducts(): Promise<Product[]> {
    const response = await fetch('http://localhost/backend/public/index.php');
    return response.json();
}
