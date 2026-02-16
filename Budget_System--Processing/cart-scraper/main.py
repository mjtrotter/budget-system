"""
Keswick Budget System - Amazon Cart Scraper Service
Cloud Run service for scraping Amazon cart data using Playwright
Backup for RapidAPI when it fails or is unavailable
"""

import os
import logging
from typing import Optional, List
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

from scraper.cart_scraper import AmazonCartScraper

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Keswick Cart Scraper",
    description="Amazon cart scraping service for Keswick Budget System",
    version="1.0.0"
)

# CORS middleware for Apps Script calls
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Key for authentication
API_KEY = os.getenv("SCRAPER_API_KEY", "keswick-cart-scraper-2024")


# Request/Response Models
class CartItem(BaseModel):
    """Individual cart item"""
    asin: str = Field(..., description="Amazon Standard Identification Number")
    title: str = Field(..., description="Product title")
    unit_price: float = Field(..., description="Price per unit")
    quantity: int = Field(default=1, description="Quantity in cart")
    line_total: float = Field(..., description="Total for this line item")
    image_url: Optional[str] = Field(None, description="Product image URL")
    product_url: Optional[str] = Field(None, description="Product page URL")


class ScrapeCartRequest(BaseModel):
    """Request to scrape a cart"""
    mode: str = Field(..., description="Scrape mode: 'cart_url' or 'asin_list'")
    cart_url: Optional[str] = Field(None, description="Amazon cart URL to scrape")
    asins: Optional[List[str]] = Field(None, description="List of ASINs to look up")


class ScrapeCartResponse(BaseModel):
    """Response from cart scraping"""
    success: bool = Field(..., description="Whether scraping succeeded")
    items: List[CartItem] = Field(default=[], description="Scraped cart items")
    cart_subtotal: float = Field(default=0.0, description="Cart subtotal")
    item_count: int = Field(default=0, description="Number of items")
    error: Optional[str] = Field(None, description="Error message if failed")


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    service: str
    version: str


# Authentication dependency
async def verify_api_key(authorization: Optional[str] = Header(None)):
    """Verify API key from Authorization header"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    # Support both "Bearer <key>" and just "<key>"
    key = authorization.replace("Bearer ", "").strip()

    if key != API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API key")

    return key


@app.get("/", response_model=HealthResponse)
async def root():
    """Root endpoint - health check"""
    return HealthResponse(
        status="healthy",
        service="Keswick Cart Scraper",
        version="1.0.0"
    )


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        service="Keswick Cart Scraper",
        version="1.0.0"
    )


@app.post("/scrape-cart", response_model=ScrapeCartResponse)
async def scrape_cart(
    request: ScrapeCartRequest,
    api_key: str = Depends(verify_api_key)
):
    """
    Scrape Amazon cart data

    Modes:
    - cart_url: Scrape items from a shared Amazon cart URL
    - asin_list: Look up product details for a list of ASINs
    """
    logger.info(f"Scrape request received: mode={request.mode}")

    try:
        scraper = AmazonCartScraper()

        if request.mode == "cart_url":
            if not request.cart_url:
                raise HTTPException(
                    status_code=400,
                    detail="cart_url required for cart_url mode"
                )

            logger.info(f"Scraping cart URL: {request.cart_url[:50]}...")
            result = await scraper.scrape_cart_url(request.cart_url)

        elif request.mode == "asin_list":
            if not request.asins or len(request.asins) == 0:
                raise HTTPException(
                    status_code=400,
                    detail="asins list required for asin_list mode"
                )

            logger.info(f"Looking up {len(request.asins)} ASINs")
            result = await scraper.lookup_asins(request.asins)

        else:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid mode: {request.mode}. Use 'cart_url' or 'asin_list'"
            )

        # Convert result to response
        items = [
            CartItem(
                asin=item.get("asin", ""),
                title=item.get("title", "Unknown"),
                unit_price=item.get("unit_price", 0.0),
                quantity=item.get("quantity", 1),
                line_total=item.get("line_total", 0.0),
                image_url=item.get("image_url"),
                product_url=item.get("product_url")
            )
            for item in result.get("items", [])
        ]

        return ScrapeCartResponse(
            success=True,
            items=items,
            cart_subtotal=result.get("subtotal", sum(i.line_total for i in items)),
            item_count=len(items)
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Scraping failed: {str(e)}", exc_info=True)
        return ScrapeCartResponse(
            success=False,
            items=[],
            cart_subtotal=0.0,
            item_count=0,
            error=str(e)
        )


@app.post("/extract-asin")
async def extract_asin(
    url: str,
    api_key: str = Depends(verify_api_key)
):
    """Extract ASIN from an Amazon product URL"""
    import re

    # Common ASIN patterns in Amazon URLs
    patterns = [
        r'/dp/([A-Z0-9]{10})',
        r'/gp/product/([A-Z0-9]{10})',
        r'/ASIN/([A-Z0-9]{10})',
        r'ASIN\.1=([A-Z0-9]{10})',
    ]

    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return {"asin": match.group(1), "success": True}

    return {"asin": None, "success": False, "error": "Could not extract ASIN from URL"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
