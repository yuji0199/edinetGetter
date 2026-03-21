# Database Schema ER Diagram

This diagram represents the current database models defined in `backend/models.py`.

```mermaid
erDiagram
    users {
        Integer id PK
        String username
        String email
        String hashed_password
        DateTime created_at
    }

    stocks {
        Integer id PK
        String securities_code
        String company_name
        String industry
        DateTime updated_at
    }

    financial_documents {
        Integer id PK
        String doc_id
        Integer stock_id FK
        DateTime period_start
        DateTime period_end
        DateTime submit_datetime
        Text metrics_json
    }

    analysis_methods {
        Integer id PK
        Integer user_id FK
        String name
        Text description
        Text conditions_json
        DateTime created_at
        DateTime updated_at
    }

    portfolios {
        Integer id PK
        Integer user_id FK
        String name
        Text description
        DateTime created_at
        DateTime updated_at
    }

    portfolio_items {
        Integer id PK
        Integer portfolio_id FK
        Integer stock_id FK
        Text notes
        Float target_price
        DateTime added_at
    }

    users ||--o{ analysis_methods : "has"
    users ||--o{ portfolios : "creates"
    stocks ||--o{ financial_documents : "has"
    portfolios ||--o{ portfolio_items : "contains"
    stocks ||--o{ portfolio_items : "included in"
```
