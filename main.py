from fastapi import FastAPI,HTTPException, Header,Depends
from bson import ObjectId
from database import products_collection,customers_collection, orders_collection, users_collection
from schemas import ProductCreate , CustomerCreate, OrderCreate, AuthentificationCreate, LoginSchema,ChangeRoleSchema,ProductUpdate
from fastapi.middleware.cors import CORSMiddleware
from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["bcrypt"])
from datetime import datetime, timezone,timedelta
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt


SECRET_KEY = "ma-cle-secrete"
ALGORITHM = "HS256"

security = HTTPBearer()
def get_current_user(user : HTTPAuthorizationCredentials = Depends(security)):
    token = user.credentials
    try :
        payload = jwt.decode(token , SECRET_KEY , algorithms = [ALGORITHM])
    except Exception as e :
        raise HTTPException(status_code = 401 , detail = "token invalide ou expiré")
    
    return payload

def require_admin(user = Depends(get_current_user)):
   
    if user["role"] == "admin":
        return user
    raise HTTPException(status_code = 403 , detail = "Action interdite : réservée aux administrateurs")



app = FastAPI()


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
@app.get("/")
def read_root():
    return {"status": "online", "message": "API operationnelle !"}




@app.post("/customers",status_code=201)
def create_customer(customer : CustomerCreate, admin : dict =  Depends(require_admin)):
    try:
        dict_customer = customer.model_dump()
        result = customers_collection.insert_one(dict_customer)
        return {
            "message" : "le customer est enregistrer en base de donnees avec succees",
            "customer_id": str(result.inserted_id)
        }
    except Exception as e :
        raise HTTPException(status_code = 500,detail = f"erreur serveur : {str(e)}")


@app.get("/customers", status_code=200)
def recuperer_customers(admin: dict = Depends(require_admin)):
    try:
        list_customers = []
        for doc in customers_collection.find():
            doc["_id"] = str(doc.get("_id"))
            list_customers.append(doc)
       
        return list_customers
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"erreur : {str(e)}")





@app.get("/customers/{id_customer}")
def recuperer_customer(id_customer : str, admin : dict =  Depends(require_admin)):
    try : 
        object_id = ObjectId(id_customer)
    except Exception as e :
        raise HTTPException(status_code = 400,detail = "ID invalide")
    result = customers_collection.find_one({"_id" : object_id})
    if result is None:
            raise HTTPException(status_code = 404,detail = "le client n existe pas")
    pipline = [{"$match" : {"_id":ObjectId(id_customer)}},{"$lookup":{
        "from" : "orders",
        "localField": "_id",
        "foreignField":"id_customer",
        "as":"commandes"
    }
    }]
    resultat = list(customers_collection.aggregate(pipline))
    resultat[0]["_id"] = str(resultat[0].get("_id"))
    for commande in resultat[0]["commandes"]:
        commande["_id"] = str(commande["_id"])
        commande["id_customer"] = str(commande["id_customer"])
        commande["id_product"] = str(commande["id_product"])
    return resultat[0]

@app.get("/customers/{id_customer}/products")
def recuperer_produits_client(id_customer : str,admin : dict =  Depends(require_admin)):
    try :
        object_id = ObjectId(id_customer)
    except Exception as e:
        raise HTTPException(status_code = 400,detail = "Id invalide")
    pipline = [{"$match" : {"_id":object_id}},{"$lookup":{
        "from" : "orders",
        "localField": "_id",
        "foreignField":"id_customer",
        "as":"commandes"
    }
    },{"$lookup":{
        "from" : "products",
        "localField":"commandes.id_product",
        "foreignField":"_id",
        "as":"produits"
        }
        },{
  "$project":{
    "_id":0,
    "full_name":1,
    "produits.nom" : 1
  }
        }]
    
    products = list(customers_collection.aggregate(pipline))
       
        
    if len(products) == 0 :
            raise HTTPException(status_code = 404,detail = "le client n existe pas")
    return products[0]
    
@app.get("/customers/stats/orders-count")
def afficher_client_nbr_commande(admin : dict =  Depends(require_admin)):
    try : 
        list_client = []
        pipline = [{"$lookup":{
  "from":"orders",
  "localField":"_id",
  "foreignField":"id_customer",
  "as":"commandes"
}},{
  "$project" : {
    "nom" : 1,
    "nbr_commandes" : {"$size":"$commandes"}
  }
}]
        result = customers_collection.aggregate(pipline)
        for doc in result:
            doc["_id"] = str(doc["_id"])
            list_client.append(doc)
        return list_client
    except Exception as e :
        raise HTTPException(status_code = 500 , detail = str(e))

@app.get("/customers/{id_customer}/total_quantite")
def quantite_total(id_customer: str, admin: dict = Depends(require_admin)):
    try:
        object_id = ObjectId(id_customer)
    except Exception:
        raise HTTPException(status_code=400, detail="ID invalide")

    pipeline = [
        {"$match": {"id_customer": object_id}},
        {"$group": {
            "_id": "$id_customer",
            "nbr_quantite": {"$sum": "$quantity"}
        }}
    ]
    try:
        result = list(orders_collection.aggregate(pipeline))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    if len(result) == 0:
        return {"_id": id_customer, "nbr_quantite": 0}
    
    result[0]["_id"] = str(result[0]["_id"])
    return result[0]


@app.get("/customers/stats/top-customer")
def meilleur_client(admin: dict = Depends(require_admin)):
    try:
        orders = list(orders_collection.find())
        if not orders:
            return {"_id": None, "total_depense": 0, "nbr_commande": 0, "client": {"full_name": "Aucun"}}

      
        products = {}
        for p in products_collection.find():
            pid_str = str(p.get("_id"))
            
            raw_price = (
                p.get("prix_vente") 
                or p.get("prixVente") 
                or p.get("selling_price") 
                or p.get("prix") 
                or p.get("price") 
                or 0
            )
            try:
                products[pid_str] = float(raw_price)
            except (ValueError, TypeError):
                products[pid_str] = 0.0

        customer_stats = {}  # {cid: {"total": 0.0, "count": 0}}

        for o in orders:
            raw_cid = o.get("id_customer")
            raw_pid = o.get("id_product")
            
            cid = str(raw_cid).strip() if raw_cid else ""
            pid = str(raw_pid).strip() if raw_pid else ""
            
            try:
                qty = int(o.get("quantity") or 1)
            except (ValueError, TypeError):
                qty = 1

            if cid:
                if cid not in customer_stats:
                    customer_stats[cid] = {"total": 0.0, "count": 0}

                unit_price = products.get(pid, 0.0)
                customer_stats[cid]["total"] += unit_price * qty
                customer_stats[cid]["count"] += 1

        if not customer_stats:
            return {"_id": None, "total_depense": 0, "nbr_commande": 0, "client": {"full_name": "Aucun"}}

        sorted_customers = sorted(customer_stats.items(), key=lambda x: x[1]["total"], reverse=True)

        for cid, stats in sorted_customers:
            cust_doc = None
            try:
                cust_doc = customers_collection.find_one({"_id": ObjectId(cid)})
            except Exception:
                pass
            if not cust_doc:
                cust_doc = customers_collection.find_one({"_id": cid})

            if cust_doc:
                return {
                    "_id": str(cust_doc.get("_id")),
                    "total_depense": round(stats["total"], 2),
                    "nbr_commande": stats["count"],
                    "client": {
                        "full_name": cust_doc.get("full_name") or cust_doc.get("name") or "Client",
                        "_id": str(cust_doc.get("_id"))
                    }
                }

        return {"_id": None, "total_depense": 0, "nbr_commande": 0, "client": {"full_name": "Aucun"}}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur : {str(e)}")

@app.delete("/customer/{id_customer}")
def supprimer_client(id_customer : str, admin : dict =  Depends(require_admin)):
    try : 
        object_id = ObjectId(id_customer)
    except Exception as e :
        raise HTTPException(status_code = 400, detail = "ID invalide")
    try :
        result = customers_collection.delete_one({"_id" : object_id})
    except Exception as e : 
        raise HTTPException(status_code = 500 , detail = f"Erreur : {str(e)}")
    if result.deleted_count == 0 :
        raise HTTPException(status_code = 404 , detail = "cette client n existe pas dans la base de donnes")
    return {
        "message" : "la suppression de client a ete fait avec succes"
    }




@app.post("/products")
def create_product(produit : ProductCreate, admin : dict =  Depends(require_admin)):
    try : 
        dict_produit = produit.model_dump()
        result = products_collection.insert_one(dict_produit)
        dict_produit["_id"]= str(result.inserted_id)
        return dict_produit
    except Exception as e :
        raise HTTPException(status_code = 500,detail = f"erreur : {str(e)}")
    
@app.get("/products")
def recuperer_produit():
    try:
        result = list(products_collection.find())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"erreur : {str(e)}")
    
    for doc in result:
        doc["_id"] = str(doc["_id"])
    return result

@app.get("/products/{id_product}")
def recuperer_produit(id_product : str):
    try :
        object_id = ObjectId(id_product)
    except Exception as e:
        raise HTTPException(status_code = 400 , detail = "ID invalide")
    try :
        result = products_collection.find_one({"_id":object_id})
    except Exception as e :
        raise HTTPException(status_code = 500 , detail = f"Erreur : {str(e)}")
    if result is None:
        raise HTTPException(status_code = 404 , detail = "cette produit n existe pas dans la base de donnees")
    result["_id"] = str(result["_id"])
    return result

@app.put("/products/{product_id}")
def update_product(product_id: str, product_data: ProductUpdate, admin: dict = Depends(require_admin)):
    try:
        data = product_data.dict(exclude_unset=True)
        update_data = {}

        if "nom" in data: update_data["nom"] = data["nom"]
        if "category" in data or "categorie" in data:
            update_data["category"] = data.get("category") or data.get("categorie")
        if "selling_price" in data or "prix_vente" in data:
            val = data.get("selling_price") if data.get("selling_price") is not None else data.get("prix_vente")
            update_data["selling_price"] = val
        if "purchase_price" in data or "prix_achat" in data:
            val = data.get("purchase_price") if data.get("purchase_price") is not None else data.get("prix_achat")
            update_data["purchase_price"] = val
            update_data["buying_price"] = val
        if "stock_quantity" in data or "stock" in data:
            st = data.get("stock_quantity") if data.get("stock_quantity") is not None else data.get("stock")
            update_data["stock_quantity"] = st
            update_data["stock"] = st

        if not update_data:
            raise HTTPException(status_code=400, detail="Aucune donnée fournie pour la mise à jour")

        result = products_collection.update_one(
            {"_id": ObjectId(product_id)},
            {"$set": update_data}
        )

        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Produit introuvable")

        return {"message": "Produit mis à jour avec succès"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors de la modification: {str(e)}")
@app.delete("/products/{id_product}")
def supprimer_produit(id_product : str , admin : dict =  Depends(require_admin)):
    try :
        object_id = ObjectId(id_product)
    except Exception as e:
        raise HTTPException(status_code = 400 , detail = "ID invalide")
    try:
        result = products_collection.delete_one({"_id":object_id})
    except Exception as e :
            raise HTTPException(status_code = 500 , detail = f"Erreur : {str(e)}")
    if result.deleted_count == 0:
        raise HTTPException(status_code = 404 , detail = "cette produit que tu veux supprimer n exsite pas")
    return {
        "message" : "ce produit a ete supprimer"
    }

@app.post("/orders")
def create_order(order : OrderCreate, admin : dict =  Depends(require_admin)):
    try :
        dict_order = order.model_dump()
        dict_order["id_product"] = ObjectId(dict_order["id_product"])
        dict_order["id_customer"] = ObjectId(dict_order["id_customer"])
    except Exception as e :
        raise HTTPException(status_code = 400 , detail = "l id invalide")
    try :
        produit = products_collection.find_one({"_id": dict_order["id_product"]})
    except Exception as e:
        raise HTTPException(status_code = 500 , detail = f"erreur : {str(e)}")
    if produit is None:
        raise HTTPException(status_code = 404 ,detail = "le produit n existe pas dans la base de donnes")

    try :
        customer = customers_collection.find_one({"_id": dict_order["id_customer"]})
    except Exception as e:
        raise HTTPException(status_code = 500 , detail = f"erreur : {str(e)}")
    if customer is None:
        raise HTTPException(status_code = 404 ,detail = "le client n existe pas dans la base de donnes")
        
    if produit["stock_quantity"] < dict_order["quantity"]:
        raise HTTPException(status_code = 400 , detail = "stock insuffisant")
    
    try :
        products_collection.update_one({"_id" : dict_order["id_product"]},{"$inc" : {"stock_quantity" : -dict_order["quantity"]}})
   
        order = orders_collection.insert_one(dict_order)
    except Exception as e :
        raise HTTPException(status_code = 500 , detail = f"erreur : {str(e)}")
    return {
        "message" : "la commande est enregistrer avec succes"
        
    }


@app.get("/orders")
def recupperer_commandes(admin: dict = Depends(require_admin)):
    try:
        result = list(orders_collection.find())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"erreur : {str(e)}")

    for doc in result:
        doc["_id"] = str(doc["_id"])
        doc["id_product"] = str(doc["id_product"])
        doc["id_customer"] = str(doc["id_customer"])
    return result

@app.get("/orders/customer/{id_customer}")
def recuperer_commande_specefique(id_customer : str, admin : dict =  Depends(require_admin)):
    try :
        object_id = ObjectId(id_customer)

    except Exception as e :
        raise HTTPException(status_code = 400, detail = "ID invalide")
    try:
        result = list(orders_collection.find({"id_customer":object_id}))

    except Exception as e :
        raise HTTPException(status_code = 500, detail = f"Erreur : {str(e)}")
    if len(result) == 0 :
        raise HTTPException(status_code = 404 , detail = "cette client n acune commande")
    for doc in result:
        doc["_id"] = str(doc["_id"])
        doc["id_product"] = str(doc["id_product"])
        doc["id_customer"] = str(doc["id_customer"])
    return result




@app.delete("/orders/{order_id}")
def supprimer_commande_historique(order_id: str, admin: dict = Depends(require_admin)):
    try:
        object_id = ObjectId(order_id)
    except Exception:
        raise HTTPException(status_code=400, detail="ID de commande invalide")
    
    try:
        result = orders_collection.delete_one({"_id": object_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Commande introuvable")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur : {str(e)}")
        
    return {"message": "Commande supprimée de l'historique (sans modifier le stock)"}

@app.get("/analytics/summary")
def summary(admin : dict =  Depends(require_admin)):
    
    pipline = [{
  "$lookup":{
    "from":"products",
    "localField":"id_product",
    "foreignField" : "_id",
    "as":"produits"
  }
},
                     {
                       "$unwind" : "$produits"
                     },
                     
                       {
                         "$group":
                         {
                           "_id":None,
                           "total_ventes" : {"$sum":{"$multiply":["$produits.selling_price","$quantity"]}},
                       "total_cout_achat" : {"$sum": {"$multiply":["$quantity","$produits.purchase_price"]}},
                           "nbr_commande" : {"$sum":1}
                         }
                       },
                     {
                       "$project":{
                         "_id":0,
                         "total_ventes" : 1,
                         "benefice_total_net" : {"$subtract":["$total_ventes","$total_cout_achat"]},
                        "nbr_commande" : 1
                       }
                     }
                     
                     
                    ]
    try :
        result = list(orders_collection.aggregate(pipline))
    except Exception as e :
        raise HTTPException(status_code = 500 , detail = f"erreur : {str(e)}")
    if len(result) == 0 :
        
        return {
        "total_ventes": 0.0,
        "benefice_total_net": 0.0,
        "nbr_commande": 0
    }
    return result[0]
   

@app.get("/analytics/top-products")
def meilleur_produit(admin : dict =  Depends(require_admin)) : 
    
    pipline = [{
  "$lookup":{
    "from":"orders",
    "localField":"_id",
    "foreignField" : "id_product",
    "as":"commandes"
  }
},{
  "$unwind":"$commandes"
},
  {
  "$group":{
    "_id":{
      "id_produit" : "$_id",
   		"nom_produit" : "$nom"

    },
    "quantite_total_vendus" : {"$sum": "$commandes.quantity"},
    
  }
},{
    "$sort":{
      "quantite_total_vendus" : -1
    }
}
                    ]
    try :
        result = list(products_collection.aggregate(pipline))
    except Exception as e :
        raise HTTPException(status_code = 500 , detail = f"erreur : {str(e)}")
    if len(result) == 0:
        raise HTTPException(status_code = 404 , detail = "aucune commande existe")
    for doc in result :
        doc["_id"]["id_produit"] = str(doc["_id"]["id_produit"])
    return result
    
@app.get("/stock_faible")
def stock_faible(admin : dict =  Depends(require_admin)):
    try : 
        result = list(products_collection.find({"stock_quantity": {"$lte" : 5}}))
    except Exception as e :
        raise HTTPException(status_code = 500 , detail = f"erreur : {str(e)}")
    if len(result) == 0:
        return []
    for doc in result :
        doc["_id"] = str(doc["_id"])
    return result


@app.post("/auth/register")
def cree_utilisateur(info: AuthentificationCreate, current_admin: dict = Depends(require_admin)):
    try:
        result = users_collection.find_one({"email": info.email})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"erreur : {str(e)}")

    if result is not None:
        raise HTTPException(status_code=409, detail="cet email existe déjà")
    
    dict_info = info.model_dump()
    if not dict_info.get("username"):
        dict_info["username"] = info.email.split("@")[0]  
        
    dict_info["password"] = pwd_context.hash(info.password)
    dict_info["role"] = "admin"  
    
    try:
        users_collection.insert_one(dict_info)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"erreur : {str(e)}")
    
    return {"message": "votre compte est créé avec succès"}


@app.post("/auth/login")
def login(info : LoginSchema) :
    try : 
        result = users_collection.find_one({"email" : info.email})
    except Exception as e :
        raise HTTPException(status_code = 500 , detail = f"erreur  : {str(e)}")

    if result is None : 
        raise HTTPException(status_code = 401 , detail = "Email ou mot de passe incorrect")
    if pwd_context.verify(info.password , result["password"]) :
        exp = datetime.now(timezone.utc) + timedelta(minutes = 60)
        data = {
            "sub" : str(result["_id"]),
            "role" : str(result["role"]),
            "exp" : exp
        }

        token = jwt.encode(data , SECRET_KEY , algorithm = ALGORITHM)
        return {
            "access_token" : token,
            "token_type" : "bearer"
        }
    raise HTTPException(status_code = 401 , detail = "Email ou mot de passe incorrect")




@app.get("/users", status_code=200)
def recuperer_utilisateurs(admin: dict = Depends(require_admin)):
    try:
        list_users = []

        for doc in users_collection.find({}, {"password": 0}):
            doc["_id"] = str(doc["_id"])
            list_users.append(doc)
        return list_users
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur : {str(e)}")

@app.delete("/users/{user_id}")
def supprimer_utilisateur(user_id: str, admin: dict = Depends(require_admin)):
    try:
        object_id = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="ID invalide")
    
    if str(admin.get("sub")) == user_id:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas supprimer votre propre compte")

    try:
        result = users_collection.delete_one({"_id": object_id})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur : {str(e)}")
        
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
        
    return {"message": "L'utilisateur a été supprimé avec succès"}



            