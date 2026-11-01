from pydantic import BaseModel, Field
from typing import Optional, Dict, Any

class ProductCreate(BaseModel):
    nom : str = Field(...,description = "nom de produit", examples = ["Écran Solaire SPF 50+"])
    category : str = Field(...,description = "la categorie de produit",examples = ["solaire"])
    purchase_price : float = Field(gt = 0,description = "le prix d achat (PA)",examples = [120])
    selling_price : float = Field(gt = 0 , description = "prix de vente (PV)", examples = [150])
    stock_quantity : int = Field(ge=0 ,description = "quantie disponible en stock",examples = [50])
    attributes : Optional[Dict[str, Any]] = Field(default = {},description = "Caractéristiques spécifiques (SPF, contenance, etc.)",examples = [{"spf": 50, "volume_ml": 50}])

class ProductUpdate(BaseModel):
    nom: Optional[str] = None
    category: Optional[str] = None
    categorie: Optional[str] = None
    purchase_price: Optional[float] = None
    prix_achat: Optional[float] = None
    selling_price: Optional[float] = None
    prix_vente: Optional[float] = None
    stock_quantity: Optional[int] = None
    stock: Optional[int] = None

class CustomerCreate(BaseModel):
    full_name : str = Field(...,description = "le nom de client",examples = ["karim"])
    phone : str = Field(...,description = "le numero de telephone",examples = ["0677735"])
    email : Optional[str] = Field(default = None,description = "l email de client",examples = ["karim@gmail.com"])
    address : Optional[str] = Field(default = None, description = "l adresse de client",examples = ["7ay atlas"])


class OrderCreate(BaseModel):
    quantity : int = Field(..., description = "la quantite commander",examples = [2])
    id_customer  : str = Field(..., description = "l id de client de cette commande", examples = [333])
    id_product : str = Field(..., description = "l id de produit",examples = [1])
                             

class AuthentificationCreate(BaseModel):
    username: Optional[str] = None
    email : str
    password : str
   
   

class LoginSchema(BaseModel):
    email: str
    password: str

class ChangeRoleSchema(BaseModel):
    user_id: str
    new_role: str

