import React, { useState, useCallback } from "react";
import {
  Upload,
  Calculator,
  FileSpreadsheet,
  TrendingUp,
  DollarSign,
  Award,
  Search,
  Package,
  ShoppingCart,
  Settings,
} from "lucide-react";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import Head from "next/head";

const LiveloPointsCalculator = () => {
  const [vtexData, setVtexData] = useState([]);
  const [costData, setCostData] = useState([]);
  const [calculations, setCalculations] = useState(null);
  const [selectedPointsMultiplier, setSelectedPointsMultiplier] = useState(3);
  const [loading, setLoading] = useState(false);
  const [currentView, setCurrentView] = useState("orders"); // 'orders' ou 'skus'
  const [selectedOrder, setSelectedOrder] = useState("");
  const [orderFilter, setOrderFilter] = useState("");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");
  const [orderSummaries, setOrderSummaries] = useState([]);
  const [dragOver, setDragOver] = useState({ vtex: false, cost: false });
  const [customPointsMultiplier, setCustomPointsMultiplier] = useState(3);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [showOrdersList, setShowOrdersList] = useState(false);
  const [showSkusList, setShowSkusList] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [showConfigTab, setShowConfigTab] = useState(false);
  const [simplesTax, setSimplesTax] = useState(8.08);
  const [paymentDiscount, setPaymentDiscount] = useState(7.0);

  const ITEMS_PER_PAGE = 10;
  const POINT_COST = 0.0449;

  const processFile = useCallback(async (file, setDataFunc) => {
    setLoading(true);
    try {
      const fileExtension = file.name.split(".").pop().toLowerCase();

      if (fileExtension === "xlsx" || fileExtension === "xls") {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        // Clean headers
        const cleanedData = jsonData.map((row) => {
          const cleanedRow = {};
          Object.keys(row).forEach((key) => {
            const cleanKey = key.trim();
            cleanedRow[cleanKey] = row[key];
          });
          return cleanedRow;
        });

        setDataFunc(cleanedData);
      } else if (fileExtension === "csv") {
        const text = await file.text();
        Papa.parse(text, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          delimitersToGuess: [",", ";", "\t"],
          complete: (results) => {
            // Clean headers
            const cleanedData = results.data.map((row) => {
              const cleanedRow = {};
              Object.keys(row).forEach((key) => {
                const cleanKey = key.trim();
                cleanedRow[cleanKey] = row[key];
              });
              return cleanedRow;
            });
            setDataFunc(cleanedData);
          },
          error: (error) => {
            console.error("Erro ao processar CSV:", error);
          },
        });
      }
    } catch (error) {
      console.error("Erro ao processar arquivo:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDragOver = useCallback((e, type) => {
    e.preventDefault();
    setDragOver((prev) => ({ ...prev, [type]: true }));
  }, []);

  const handleDragLeave = useCallback((e, type) => {
    e.preventDefault();
    setDragOver((prev) => ({ ...prev, [type]: false }));
  }, []);

  const handleDrop = useCallback(
    (e, setDataFunc) => {
      e.preventDefault();
      setDragOver({ vtex: false, cost: false });

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        const file = files[0];
        const allowedExtensions = ["xlsx", "xls", "csv"];
        const fileExtension = file.name.split(".").pop().toLowerCase();

        if (allowedExtensions.includes(fileExtension)) {
          processFile(file, setDataFunc);
        } else {
          alert("Por favor, envie apenas arquivos XLSX, XLS ou CSV.");
        }
      }
    },
    [processFile]
  );

  const parseBrazilianFloat = (value) => {
    if (!value || value === "") return 0;

    let stringValue = value.toString();

    stringValue = stringValue.trim();

    if (typeof value === "number") return value;

    if (stringValue.includes(",")) {
      if (stringValue.includes(".") && stringValue.includes(",")) {
        stringValue = stringValue.replace(/\./g, "").replace(",", ".");
      } else if (stringValue.includes(",") && !stringValue.includes(".")) {
        stringValue = stringValue.replace(",", ".");
      }
    }

    return parseFloat(stringValue) || 0;
  };

  const calculatePoints = useCallback(() => {
    if (vtexData.length === 0 || costData.length === 0) {
      alert("Por favor, carregue ambas as planilhas antes de calcular.");
      return;
    }

    const results = [];
    const orderSummariesTemp = {};

    vtexData.forEach((order) => {
      const orderNumber = order["Order"] || order["order"] || order.Order || "";
      const skuCode =
        order["Reference Code"] ||
        order["reference code"] ||
        order.ReferenceCode;

      const shippingValue = parseBrazilianFloat(
        order["Shipping Value"] ||
          order["shipping value"] ||
          order.ShippingValue ||
          0
      );
      const shippingListPrice = parseBrazilianFloat(
        order["Shipping List Price"] ||
          order["shipping list price"] ||
          order.ShippingListPrice ||
          0
      );

      const skuTotalPrice = parseBrazilianFloat(
        order["SKU Total Price"] ||
          order["sku total price"] ||
          order.SKUTotalPrice ||
          0
      );

      const orderTotalValue = parseBrazilianFloat(
        order["Total Value"] ||
          order["total value"] ||
          order.TotalValue ||
          order["Payment Value"] ||
          order["payment value"] ||
          order.PaymentValue ||
          0
      );

      const shippingCostForThisSku =
        shippingValue === 0 ? shippingListPrice : 0;

      const costInfo = costData.find(
        (cost) =>
          cost.SKU === skuCode ||
          cost.sku === skuCode ||
          cost["SKU"] === skuCode ||
          cost["sku"] === skuCode
      );

      const sellingPriceRaw =
        order["SKU Selling Price"] ||
        order["sku selling price"] ||
        order.SKUSellingPrice ||
        "";

      const saleValue = parseBrazilianFloat(sellingPriceRaw);
      const quantity = parseBrazilianFloat(
        order["Quantity_SKU"] || order["quantity_sku"] || order.QuantitySKU || 1
      );
      const costValue = parseBrazilianFloat(
        costInfo?.["CUSTO PRODUTO"] ||
          costInfo?.["custo produto"] ||
          costInfo?.CustoProduto ||
          0
      );

      const productName =
        order["SKU Name"] || order["sku name"] || order.SKUName || "";
      const creationDate =
        order["Creation Date"] ||
        order["creation date"] ||
        order.CreationDate ||
        "";
      const orderDate = creationDate ? creationDate.split("T")[0] : "";

      if (costInfo && saleValue > 0 && costValue > 0) {
        if (!orderSummariesTemp[orderNumber]) {
          orderSummariesTemp[orderNumber] = {
            orderNumber,
            orderDate,
            items: [],
            totalSales: 0,
            totalCosts: 0,
            totalQuantity: 0,
            totalShippingCost: 0,
            totalSkuPrice: 0,
            orderRealValue: orderTotalValue,
          };
        }

        orderSummariesTemp[orderNumber].totalSales += saleValue * quantity;
        orderSummariesTemp[orderNumber].totalCosts += costValue * quantity;
        orderSummariesTemp[orderNumber].totalQuantity += quantity;
        orderSummariesTemp[orderNumber].totalShippingCost +=
          shippingCostForThisSku;
        orderSummariesTemp[orderNumber].totalSkuPrice += skuTotalPrice;

        const pointsCalculations = showCustomInput
          ? [customPointsMultiplier].map((multiplier) => {
              const totalPoints = saleValue * multiplier * quantity;
              const pointsCost = totalPoints * POINT_COST;
              const grossProfit = (saleValue - costValue) * quantity;
              const taxAmount = (saleValue * quantity * simplesTax) / 100;
              const discountAmount =
                (saleValue * quantity * paymentDiscount) / 100;

              const netProfit =
                grossProfit -
                pointsCost -
                taxAmount -
                discountAmount -
                shippingCostForThisSku;
              const profitMargin = (netProfit / (saleValue * quantity)) * 100;

              return {
                multiplier,
                totalPoints,
                pointsCost,
                grossProfit,
                netProfit,
                profitMargin,
                shippingCost: shippingCostForThisSku,
              };
            })
          : [3, 6, 8, 10].map((multiplier) => {
              const totalPoints = saleValue * multiplier * quantity;
              const pointsCost = totalPoints * POINT_COST;
              const grossProfit = (saleValue - costValue) * quantity;
              const taxAmount = (saleValue * quantity * simplesTax) / 100;
              const discountAmount =
                (saleValue * quantity * paymentDiscount) / 100;

              const netProfit =
                grossProfit -
                pointsCost -
                taxAmount -
                discountAmount -
                shippingCostForThisSku;
              const profitMargin = (netProfit / (saleValue * quantity)) * 100;

              return {
                multiplier,
                totalPoints,
                pointsCost,
                grossProfit,
                netProfit,
                profitMargin,
                shippingCost: shippingCostForThisSku,
              };
            });

        const item = {
          orderNumber,
          sku: skuCode,
          referenceCode: skuCode,
          productName,
          quantity,
          unitSaleValue: saleValue,
          saleValue: saleValue * quantity,
          unitCostValue: costValue,
          costValue: costValue * quantity,
          orderDate,
          pointsCalculations,
          shippingValue: shippingValue,
          shippingListPrice: shippingListPrice,
          skuShippingCost: shippingCostForThisSku,
          skuTotalPrice: skuTotalPrice,
          orderRealValue: orderTotalValue,
        };

        results.push(item);
        orderSummariesTemp[orderNumber].items.push(item);
      }
    });

    const orderSummariesArray = Object.values(orderSummariesTemp).map(
      (orderSummary) => {
        const pointsCalculations = showCustomInput
          ? [customPointsMultiplier].map((multiplier) => {
              const totalPoints = orderSummary.totalSales * multiplier;
              const pointsCost = totalPoints * POINT_COST;
              const grossProfit =
                orderSummary.totalSales - orderSummary.totalCosts;
              const taxAmount = (orderSummary.totalSales * simplesTax) / 100;
              const discountAmount =
                (orderSummary.totalSales * paymentDiscount) / 100;

              const netProfit =
                grossProfit -
                pointsCost -
                taxAmount -
                discountAmount -
                orderSummary.totalShippingCost;
              const profitMargin = (netProfit / orderSummary.totalSales) * 100;

              return {
                multiplier,
                totalPoints,
                pointsCost,
                grossProfit,
                netProfit,
                profitMargin,
                shippingCost: orderSummary.totalShippingCost,
              };
            })
          : [3, 6, 8, 10].map((multiplier) => {
              const totalPoints = orderSummary.totalSales * multiplier;
              const pointsCost = totalPoints * POINT_COST;
              const grossProfit =
                orderSummary.totalSales - orderSummary.totalCosts;
              const taxAmount = (orderSummary.totalSales * simplesTax) / 100;
              const discountAmount =
                (orderSummary.totalSales * paymentDiscount) / 100;

              const netProfit =
                grossProfit -
                pointsCost -
                taxAmount -
                discountAmount -
                orderSummary.totalShippingCost;
              const profitMargin = (netProfit / orderSummary.totalSales) * 100;

              return {
                multiplier,
                totalPoints,
                pointsCost,
                grossProfit,
                netProfit,
                profitMargin,
                shippingCost: orderSummary.totalShippingCost,
              };
            });

        return {
          ...orderSummary,
          pointsCalculations,
        };
      }
    );

    setCalculations(results);
    setOrderSummaries(orderSummariesArray);
  }, [
    vtexData,
    costData,
    showCustomInput,
    customPointsMultiplier,
    simplesTax,
    paymentDiscount,
  ]);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value || 0);
  };

  const formatNumber = (value) => {
    return new Intl.NumberFormat("pt-BR").format(value || 0);
  };

  const getSelectedCalculation = (item) => {
    const targetMultiplier = showCustomInput
      ? customPointsMultiplier
      : selectedPointsMultiplier;
    return (
      item.pointsCalculations.find(
        (calc) => calc.multiplier === targetMultiplier
      ) || item.pointsCalculations[0]
    );
  };

  const getTotalSummary = () => {
    if (!calculations) return null;

    if (hasActiveFilters()) {
      const filteredOrderNumbers = getFilteredOrders().map(
        (order) => order.orderNumber
      );
      const filteredCalculations = calculations.filter((item) =>
        filteredOrderNumbers.includes(item.orderNumber)
      );

      const uniqueOrderNumbers = [
        ...new Set(filteredCalculations.map((item) => item.orderNumber)),
      ];

      const totalRealValue = uniqueOrderNumbers.reduce((sum, orderNumber) => {
        const orderItem = filteredCalculations.find(
          (item) => item.orderNumber === orderNumber
        );
        return sum + (orderItem?.orderRealValue || 0);
      }, 0);

      return filteredCalculations.reduce(
        (acc, item) => {
          const calc = getSelectedCalculation(item);
          return {
            totalSales: acc.totalSales + item.saleValue,
            totalCosts: acc.totalCosts + item.costValue,
            totalPointsCost: acc.totalPointsCost + calc.pointsCost,
            totalNetProfit: acc.totalNetProfit + calc.netProfit,
            totalPoints: acc.totalPoints + calc.totalPoints,
            totalShippingCost: acc.totalShippingCost + (calc.shippingCost || 0),
            totalSkuPrice: acc.totalSkuPrice + (item.skuTotalPrice || 0),
            totalRealValue: totalRealValue,
            totalOrders: uniqueOrderNumbers.length,
            totalSKUs: filteredCalculations.length,
          };
        },
        {
          totalSales: 0,
          totalCosts: 0,
          totalPointsCost: 0,
          totalNetProfit: 0,
          totalPoints: 0,
          totalShippingCost: 0,
          totalSkuPrice: 0,
          totalRealValue: 0,
        }
      );
    }

    const uniqueOrderNumbers = [
      ...new Set(calculations.map((item) => item.orderNumber)),
    ];

    const totalRealValue = uniqueOrderNumbers.reduce((sum, orderNumber) => {
      const orderItem = calculations.find(
        (item) => item.orderNumber === orderNumber
      );
      return sum + (orderItem?.orderRealValue || 0);
    }, 0);

    return calculations.reduce(
      (acc, item) => {
        const calc = getSelectedCalculation(item);
        return {
          totalSales: acc.totalSales + item.saleValue,
          totalCosts: acc.totalCosts + item.costValue,
          totalPointsCost: acc.totalPointsCost + calc.pointsCost,
          totalNetProfit: acc.totalNetProfit + calc.netProfit,
          totalPoints: acc.totalPoints + calc.totalPoints,
          totalShippingCost: acc.totalShippingCost + (calc.shippingCost || 0),
          totalSkuPrice: acc.totalSkuPrice + (item.skuTotalPrice || 0),
          totalRealValue: totalRealValue,
          totalOrders: uniqueOrderNumbers.length,
          totalSKUs: calculations.length,
        };
      },
      {
        totalSales: 0,
        totalCosts: 0,
        totalPointsCost: 0,
        totalNetProfit: 0,
        totalPoints: 0,
        totalShippingCost: 0,
        totalSkuPrice: 0,
        totalRealValue: 0,
      }
    );
  };

  const getFilteredOrders = () => {
    if (!orderSummaries) return [];

    let filtered = orderSummaries;

    if (orderFilter) {
      filtered = filtered.filter((order) =>
        order.orderNumber
          .toString()
          .toLowerCase()
          .includes(orderFilter.toLowerCase())
      );
    }

    if (startDateFilter || endDateFilter) {
      filtered = filtered.filter((order) => {
        if (!order.orderDate) return false;

        const orderDate = new Date(order.orderDate);
        let isInRange = true;

        if (startDateFilter) {
          const startDate = new Date(startDateFilter);
          isInRange = isInRange && orderDate >= startDate;
        }

        if (endDateFilter) {
          const endDate = new Date(endDateFilter);
          isInRange = isInRange && orderDate <= endDate;
        }

        return isInRange;
      });
    }

    return filtered;
  };

  const getDateRangeText = () => {
    if (startDateFilter && endDateFilter) {
      return `de ${formatDate(startDateFilter)} até ${formatDate(
        endDateFilter
      )}`;
    } else if (startDateFilter) {
      return `a partir de ${formatDate(startDateFilter)}`;
    } else if (endDateFilter) {
      return `até ${formatDate(endDateFilter)}`;
    }
    return "";
  };

  const hasActiveFilters = () => {
    return !!(startDateFilter || endDateFilter || orderFilter);
  };

  const clearAllFilters = () => {
    setStartDateFilter("");
    setEndDateFilter("");
    setOrderFilter("");
  };

  const getOrderItems = (orderNumber) => {
    if (!calculations) return [];
    return calculations.filter((item) => item.orderNumber === orderNumber);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR");
  };

  const summary = getTotalSummary();
  const filteredOrders = getFilteredOrders();

  const getPaginatedItems = (items) => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return items.slice(startIndex, endIndex);
  };

  const getTotalPages = (totalItems) => {
    return Math.ceil(totalItems / ITEMS_PER_PAGE);
  };

  const renderPagination = (totalItems) => {
    const totalPages = getTotalPages(totalItems);
    if (totalPages <= 1) return null;

    return (
      <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t">
        <div className="text-sm text-gray-700">
          Mostrando {(currentPage - 1) * ITEMS_PER_PAGE + 1} até{" "}
          {Math.min(currentPage * ITEMS_PER_PAGE, totalItems)} de {totalItems}{" "}
          itens
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Anterior
          </button>

          {/* Páginas */}
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (currentPage <= 3) {
              pageNum = i + 1;
            } else if (currentPage >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = currentPage - 2 + i;
            }

            return (
              <button
                key={pageNum}
                onClick={() => setCurrentPage(pageNum)}
                className={`px-3 py-2 text-sm font-medium rounded-lg ${
                  currentPage === pageNum
                    ? "bg-purple-600 text-white"
                    : "text-gray-500 bg-white border border-gray-300 hover:bg-gray-50"
                }`}
              >
                {pageNum}
              </button>
            );
          })}

          <button
            onClick={() =>
              setCurrentPage(Math.min(totalPages, currentPage + 1))
            }
            disabled={currentPage === totalPages}
            className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Próximo
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      <Head>
        <title>LIVELO Points Calculator</title>
        <meta
          name="description"
          content="Análise completa de pontuação e lucratividade LIVELO"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        {/* Header */}
        <div className="bg-white shadow-lg border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-3 rounded-xl">
                <Award className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                  LIVELO Points Calculator
                </h1>
                <p className="text-gray-600 mt-1">
                  Análise completa de pontuação e lucratividade por pedido
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
          {/* Upload Section */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* VTEX Upload */}
            <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
              <div className="flex items-center space-x-3 mb-4">
                <div className="bg-green-100 p-2 rounded-lg">
                  <FileSpreadsheet className="h-6 w-6 text-green-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-800">
                  Dados VTEX
                </h2>
              </div>
              <p className="text-gray-600 mb-4">
                Upload da planilha VTEX (Order + Reference Code + SKU Selling
                Price)
              </p>
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200 ${
                  dragOver.vtex
                    ? "border-green-400 bg-green-50"
                    : "border-gray-300 hover:border-green-400"
                }`}
                onDragOver={(e) => handleDragOver(e, "vtex")}
                onDragLeave={(e) => handleDragLeave(e, "vtex")}
                onDrop={(e) => handleDrop(e, setVtexData)}
              >
                <Upload
                  className={`h-8 w-8 mx-auto mb-2 ${
                    dragOver.vtex ? "text-green-600" : "text-gray-400"
                  }`}
                />
                <div className="space-y-2">
                  <p
                    className={`font-medium ${
                      dragOver.vtex ? "text-green-700" : "text-green-600"
                    }`}
                  >
                    {dragOver.vtex
                      ? "Solte o arquivo aqui!"
                      : "Arraste o arquivo aqui"}
                  </p>
                  <p className="text-gray-500 text-sm">ou</p>
                  <label className="cursor-pointer">
                    <span className="text-green-600 font-medium hover:text-green-700 underline">
                      clique para selecionar
                    </span>
                    <input
                      type="file"
                      className="hidden"
                      accept=".xlsx,.xls,.csv"
                      onChange={(e) =>
                        e.target.files[0] &&
                        processFile(e.target.files[0], setVtexData)
                      }
                    />
                  </label>
                </div>
                <p className="text-sm text-gray-500 mt-3">XLSX, XLS ou CSV</p>
                {vtexData.length > 0 && (
                  <div className="mt-4 p-3 bg-green-100 rounded-lg">
                    <div className="text-green-600 font-medium">
                      ✓ {vtexData.length} registros carregados
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Cost Upload */}
            <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
              <div className="flex items-center space-x-3 mb-4">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <DollarSign className="h-6 w-6 text-blue-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-800">
                  Planilha de Custos
                </h2>
              </div>
              <p className="text-gray-600 mb-4">
                Upload da planilha de custos (SKU + CUSTO PRODUTO)
              </p>
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200 ${
                  dragOver.cost
                    ? "border-blue-400 bg-blue-50"
                    : "border-gray-300 hover:border-blue-400"
                }`}
                onDragOver={(e) => handleDragOver(e, "cost")}
                onDragLeave={(e) => handleDragLeave(e, "cost")}
                onDrop={(e) => handleDrop(e, setCostData)}
              >
                <Upload
                  className={`h-8 w-8 mx-auto mb-2 ${
                    dragOver.cost ? "text-blue-600" : "text-gray-400"
                  }`}
                />
                <div className="space-y-2">
                  <p
                    className={`font-medium ${
                      dragOver.cost ? "text-blue-700" : "text-blue-600"
                    }`}
                  >
                    {dragOver.cost
                      ? "Solte o arquivo aqui!"
                      : "Arraste o arquivo aqui"}
                  </p>
                  <p className="text-gray-500 text-sm">ou</p>
                  <label className="cursor-pointer">
                    <span className="text-blue-600 font-medium hover:text-blue-700 underline">
                      clique para selecionar
                    </span>
                    <input
                      type="file"
                      className="hidden"
                      accept=".xlsx,.xls,.csv"
                      onChange={(e) =>
                        e.target.files[0] &&
                        processFile(e.target.files[0], setCostData)
                      }
                    />
                  </label>
                </div>
                <p className="text-sm text-gray-500 mt-3">XLSX, XLS ou CSV</p>
                {costData.length > 0 && (
                  <div className="mt-4 p-3 bg-blue-100 rounded-lg">
                    <div className="text-blue-600 font-medium">
                      ✓ {costData.length} registros carregados
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Calculate Button */}
          <div className="text-center">
            <button
              onClick={calculatePoints}
              disabled={
                loading || vtexData.length === 0 || costData.length === 0
              }
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold px-8 py-4 rounded-xl shadow-lg transition-all duration-200 transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed flex items-center space-x-2 mx-auto"
            >
              <Calculator className="h-5 w-5" />
              <span>{loading ? "Processando..." : "Calcular Pontuação"}</span>
            </button>
          </div>

          {/* Points Options */}
          {calculations && (
            <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center space-x-2">
                <TrendingUp className="h-6 w-6 text-purple-600" />
                <span>Cenários de Pontuação</span>
              </h2>
              <div className="flex items-center space-x-4 mb-6">
                <button
                  onClick={() => setShowCustomInput(false)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                    !showCustomInput
                      ? "bg-purple-600 text-white shadow-lg"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Opções Padrão
                </button>
                <button
                  onClick={() => setShowCustomInput(true)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                    showCustomInput
                      ? "bg-purple-600 text-white shadow-lg"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Valor Customizado
                </button>
              </div>

              {/* Opções padrão ou input customizado */}
              {!showCustomInput ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {[3, 6, 8, 10].map((points) => (
                    <button
                      key={points}
                      onClick={() => setSelectedPointsMultiplier(points)}
                      className={`p-4 rounded-xl font-semibold transition-all duration-200 ${
                        selectedPointsMultiplier === points
                          ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg transform scale-105"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {points} Pontos/R$
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Multiplicador de Pontos (Pontos por R$)
                  </label>
                  <div className="flex items-center space-x-4">
                    <input
                      type="number"
                      min="0.1"
                      max="100"
                      step="0.1"
                      value={customPointsMultiplier}
                      onChange={(e) =>
                        setCustomPointsMultiplier(
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="border border-gray-300 rounded-lg px-4 py-3 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent w-32"
                      placeholder="Ex: 3.5"
                    />
                    <span className="text-gray-600 font-medium">Pontos/R$</span>
                    <button
                      onClick={calculatePoints}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200"
                    >
                      Recalcular
                    </button>
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    Digite qualquer valor decimal (ex: 3.5, 7.2, 12.8)
                  </p>
                </div>
              )}

              {/* Summary Cards */}
              {summary && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-3 mb-6">
                  <div className="bg-gradient-to-r from-green-50 to-green-100 p-3 rounded-xl border border-green-200">
                    <p className="text-green-600 text-xs font-medium mb-1">
                      Total Vendas{" "}
                      {hasActiveFilters() && (
                        <span className="text-xs">(Filtrado)</span>
                      )}
                    </p>
                    <p className="text-lg xl:text-xl font-bold text-green-700 leading-tight">
                      {formatCurrency(summary.totalSales)}
                    </p>
                  </div>
                  <div className="bg-gradient-to-r from-red-50 to-red-100 p-3 rounded-xl border border-red-200">
                    <p className="text-red-600 text-xs font-medium mb-1">
                      Total Custos{" "}
                      {hasActiveFilters() && (
                        <span className="text-xs">(Filtrado)</span>
                      )}
                    </p>
                    <p className="text-lg xl:text-xl font-bold text-red-700 leading-tight">
                      {formatCurrency(summary.totalCosts)}
                    </p>
                  </div>
                  <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-3 rounded-xl border border-purple-200">
                    <p className="text-purple-600 text-xs font-medium mb-1">
                      Custo Pontos{" "}
                      {hasActiveFilters() && (
                        <span className="text-xs">(Filtrado)</span>
                      )}
                    </p>
                    <p className="text-lg xl:text-xl font-bold text-purple-700 leading-tight">
                      {formatCurrency(summary.totalPointsCost)}
                    </p>
                  </div>
                  <div className="bg-gradient-to-r from-orange-50 to-orange-100 p-3 rounded-xl border border-orange-200">
                    <p className="text-orange-600 text-xs font-medium mb-1">
                      Custo Frete{" "}
                      {hasActiveFilters() && (
                        <span className="text-xs">(Filtrado)</span>
                      )}
                    </p>
                    <p className="text-lg xl:text-xl font-bold text-orange-700 leading-tight">
                      {formatCurrency(summary.totalShippingCost)}
                    </p>
                  </div>
                  <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-3 rounded-xl border border-blue-200">
                    <p className="text-blue-600 text-xs font-medium mb-1">
                      Total Pontos{" "}
                      {hasActiveFilters() && (
                        <span className="text-xs">(Filtrado)</span>
                      )}
                    </p>
                    <p className="text-lg xl:text-xl font-bold text-blue-700 leading-tight">
                      {formatNumber(summary.totalPoints)}
                    </p>
                  </div>
                  <div className="bg-gradient-to-r from-indigo-50 to-indigo-100 p-3 rounded-xl border border-indigo-200">
                    <p className="text-indigo-600 text-xs font-medium mb-1">
                      Lucro Líquido{" "}
                      {hasActiveFilters() && (
                        <span className="text-xs">(Filtrado)</span>
                      )}
                    </p>
                    <p className="text-lg xl:text-xl font-bold text-indigo-700 leading-tight">
                      {formatCurrency(summary.totalNetProfit)}
                    </p>
                  </div>
                  <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 p-3 rounded-xl border border-yellow-200">
                    <p className="text-yellow-600 text-xs font-medium mb-1">
                      Ticket Médio{" "}
                      {hasActiveFilters() && (
                        <span className="text-xs">(Filtrado)</span>
                      )}
                    </p>
                    <p className="text-lg xl:text-xl font-bold text-yellow-700 leading-tight">
                      {formatCurrency(
                        summary.totalOrders > 0
                          ? summary.totalRealValue / summary.totalOrders
                          : 0
                      )}
                    </p>
                  </div>

                  <div className="bg-gradient-to-r from-orange-50 to-orange-100 p-3 rounded-xl border border-orange-200">
                    <p className="text-orange-600 text-xs font-medium mb-1">
                      Total Pedidos{" "}
                      {hasActiveFilters() && (
                        <span className="text-xs">(Filtrado)</span>
                      )}
                    </p>
                    <p className="text-lg xl:text-xl font-bold text-orange-700 leading-tight">
                      {formatNumber(summary.totalOrders)}
                    </p>
                  </div>
                  <div className="bg-gradient-to-r from-teal-50 to-teal-100 p-3 rounded-xl border border-teal-200">
                    <p className="text-teal-600 text-xs font-medium mb-1">
                      Total SKUs{" "}
                      {hasActiveFilters() && (
                        <span className="text-xs">(Filtrado)</span>
                      )}
                    </p>
                    <p className="text-lg xl:text-xl font-bold text-teal-700 leading-tight">
                      {formatNumber(summary.totalSKUs)}
                    </p>
                  </div>
                </div>
              )}

              {/* Configuration Tab */}
              <div className="flex space-x-4 mb-6">
                <button
                  onClick={() => {
                    setShowConfigTab(!showConfigTab);
                    setShowOrdersList(false);
                    setShowSkusList(false);
                  }}
                  className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                    showConfigTab
                      ? "bg-green-600 text-white shadow-lg"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <Settings className="h-5 w-5" />
                  <span>{showConfigTab ? "Fechar" : "Configurações"}</span>
                </button>

                <button
                  onClick={() => {
                    setShowOrdersList(!showOrdersList);
                    setShowSkusList(false);
                    setShowConfigTab(false);
                    setCurrentView("orders");
                    setCurrentPage(1);
                  }}
                  className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                    showOrdersList && currentView === "orders"
                      ? "bg-purple-600 text-white shadow-lg"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <ShoppingCart className="h-5 w-5" />
                  <span>
                    {showOrdersList && currentView === "orders"
                      ? "Ocultar"
                      : "Ver"}{" "}
                    Pedidos
                  </span>
                </button>

                <button
                  onClick={() => {
                    setShowSkusList(!showSkusList);
                    setShowOrdersList(false);
                    setShowConfigTab(false);
                    setCurrentView("skus");
                    setCurrentPage(1);
                  }}
                  className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                    showSkusList && currentView === "skus"
                      ? "bg-purple-600 text-white shadow-lg"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <Package className="h-5 w-5" />
                  <span>
                    {showSkusList && currentView === "skus" ? "Ocultar" : "Ver"}{" "}
                    SKUs
                  </span>
                </button>
              </div>

              {/* Configuration Section */}
              {showConfigTab && (
                <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100 mt-6">
                  <h2 className="text-xl font-semibold text-gray-800 mb-6 flex items-center space-x-2">
                    <Settings className="h-6 w-6 text-green-600" />
                    <span>Configurações de Cálculo</span>
                  </h2>

                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Simples Nacional */}
                    <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200">
                      <label className="block text-blue-800 font-semibold mb-2">
                        Simples Nacional (%)
                      </label>
                      <div className="flex items-center space-x-3">
                        <input
                          type="number"
                          min="0"
                          max="50"
                          step="0.01"
                          value={simplesTax}
                          onChange={(e) =>
                            setSimplesTax(parseFloat(e.target.value) || 0)
                          }
                          className="border border-blue-300 rounded-lg px-4 py-3 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-32"
                          placeholder="8.08"
                        />
                        <span className="text-blue-700 font-medium">%</span>
                      </div>
                      <p className="text-sm text-blue-600 mt-2">
                        Alíquota do Simples Nacional aplicada sobre vendas
                      </p>
                    </div>

                    {/* Desconto Pagamento */}
                    <div className="bg-gradient-to-r from-orange-50 to-orange-100 p-4 rounded-xl border border-orange-200">
                      <label className="block text-orange-800 font-semibold mb-2">
                        Desconto Pagar.me (%)
                      </label>
                      <div className="flex items-center space-x-3">
                        <input
                          type="number"
                          min="0"
                          max="50"
                          step="0.01"
                          value={paymentDiscount}
                          onChange={(e) =>
                            setPaymentDiscount(parseFloat(e.target.value) || 0)
                          }
                          className="border border-orange-300 rounded-lg px-4 py-3 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent w-32"
                          placeholder="7.0"
                        />
                        <span className="text-orange-700 font-medium">%</span>
                      </div>
                      <p className="text-sm text-orange-600 mt-2">
                        Percentual de desconto da operadora de pagamento
                      </p>
                    </div>
                  </div>

                  {/* Botão recalcular */}
                  <div className="mt-6 text-center">
                    <button
                      onClick={calculatePoints}
                      disabled={
                        loading ||
                        vtexData.length === 0 ||
                        costData.length === 0
                      }
                      className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold px-6 py-3 rounded-xl shadow-lg transition-all duration-200 transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed"
                    >
                      Recalcular com Novas Configurações
                    </button>
                  </div>

                  {/* Resumo dos impostos */}
                  {summary && (
                    <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                      <h3 className="font-semibold text-gray-800 mb-3">
                        Resumo dos Impostos:
                      </h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">
                            Simples Nacional ({simplesTax}%):
                          </span>
                          <span className="font-semibold text-blue-600 ml-2">
                            {formatCurrency(
                              (summary.totalSales * simplesTax) / 100
                            )}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">
                            Desconto Pagar.me ({paymentDiscount}%):
                          </span>
                          <span className="font-semibold text-orange-600 ml-2">
                            {formatCurrency(
                              (summary.totalSales * paymentDiscount) / 100
                            )}
                          </span>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <span className="text-gray-600">
                          Total Impostos/Descontos:
                        </span>
                        <span className="font-bold text-red-600 ml-2">
                          {formatCurrency(
                            (summary.totalSales *
                              (simplesTax + paymentDiscount)) /
                              100
                          )}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Orders View */}
          {calculations && showOrdersList && currentView === "orders" && (
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
              <div className="p-6 border-b border-gray-200">
                <div className="flex flex-col gap-4">
                  <h2 className="text-xl font-semibold text-gray-800">
                    Análise por Pedido -{" "}
                    {showCustomInput
                      ? customPointsMultiplier
                      : selectedPointsMultiplier}{" "}
                    Pontos/R$
                  </h2>

                  {/* Filtros em linha organizada */}
                  <div className="flex flex-wrap items-center gap-4">
                    {/* Filtro por Range de Datas */}
                    <div className="flex items-center gap-3">
                      <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                        Período:
                      </label>
                      <input
                        type="date"
                        value={startDateFilter}
                        onChange={(e) => setStartDateFilter(e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="Data início"
                      />
                      <span className="text-gray-500 text-sm">até</span>
                      <input
                        type="date"
                        value={endDateFilter}
                        onChange={(e) => setEndDateFilter(e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="Data fim"
                      />
                    </div>

                    {/* Filtro por Pedido */}
                    <div className="flex items-center gap-2">
                      <Search className="h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Filtrar por pedido..."
                        value={orderFilter}
                        onChange={(e) => setOrderFilter(e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent w-48"
                      />
                    </div>

                    {/* Botão para limpar filtros */}
                    {hasActiveFilters() && (
                      <button
                        onClick={clearAllFilters}
                        className="text-sm text-red-600 hover:text-red-800 underline font-medium"
                      >
                        Limpar filtros
                      </button>
                    )}
                  </div>
                </div>

                {/* Contador de resultados */}
                {hasActiveFilters() && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                    <p className="text-blue-700 text-sm">
                      {filteredOrders.length === 0
                        ? "Nenhum pedido encontrado com os filtros aplicados"
                        : `${filteredOrders.length} ${
                            filteredOrders.length === 1
                              ? "pedido encontrado"
                              : "pedidos encontrados"
                          }`}

                      {/* Mostra filtros ativos */}
                      {getDateRangeText() && (
                        <span className="font-medium">
                          {" "}
                          {getDateRangeText()}
                        </span>
                      )}
                      {orderFilter && (
                        <span className="font-medium">
                          {" "}
                          contendo "{orderFilter}"
                        </span>
                      )}
                    </p>
                  </div>
                )}
              </div>

              <div className="p-6 space-y-4">
                {getPaginatedItems(filteredOrders).map((order, index) => {
                  const orderCalc = getSelectedCalculation(order);
                  return (
                    <div
                      key={index}
                      className="border border-gray-200 rounded-lg overflow-hidden"
                    >
                      {/* Order Header */}
                      <div
                        className="bg-gray-50 p-4 cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() =>
                          setSelectedOrder(
                            selectedOrder === order.orderNumber
                              ? ""
                              : order.orderNumber
                          )
                        }
                      >
                        <div className="flex justify-between items-center">
                          <div className="flex items-center space-x-4">
                            <h3 className="text-lg font-semibold text-gray-800">
                              Pedido: {order.orderNumber}
                            </h3>
                            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                              {order.items.length}{" "}
                              {order.items.length === 1 ? "item" : "itens"}
                            </span>
                            {order.orderDate && (
                              <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm">
                                {formatDate(order.orderDate)}
                              </span>
                            )}
                          </div>
                          <div className="flex space-x-6 text-sm">
                            <div>
                              <span className="text-gray-500">Vendas: </span>
                              <span className="font-medium text-green-600">
                                {formatCurrency(order.totalSales)}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500">Custos: </span>
                              <span className="font-medium text-red-600">
                                {formatCurrency(order.totalCosts)}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500">Lucro: </span>
                              <span
                                className={`font-medium ${
                                  orderCalc.netProfit >= 0
                                    ? "text-green-600"
                                    : "text-red-600"
                                }`}
                              >
                                {formatCurrency(orderCalc.netProfit)}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500">Pontos: </span>
                              <span className="font-medium text-purple-600">
                                {formatNumber(orderCalc.totalPoints)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Order Items - Expandible */}
                      {selectedOrder === order.orderNumber && (
                        <div className="bg-white">
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    SKU
                                  </th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Produto
                                  </th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Qtd
                                  </th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Preço Unit
                                  </th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Custo Unit
                                  </th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Pontos
                                  </th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Lucro
                                  </th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Margem
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                {order.items.map((item, itemIndex) => {
                                  const itemCalc = getSelectedCalculation(item);
                                  return (
                                    <tr
                                      key={itemIndex}
                                      className="hover:bg-gray-50"
                                    >
                                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                        {item.referenceCode}
                                      </td>
                                      <td
                                        className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate"
                                        title={item.productName}
                                      >
                                        {item.productName}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-gray-900">
                                        {item.quantity}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-gray-900">
                                        {formatCurrency(item.unitSaleValue)}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-gray-900">
                                        {formatCurrency(item.unitCostValue)}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-gray-900">
                                        {formatNumber(itemCalc.totalPoints)}
                                      </td>
                                      <td className="px-4 py-3 text-sm">
                                        <span
                                          className={
                                            itemCalc.netProfit >= 0
                                              ? "text-green-600"
                                              : "text-red-600"
                                          }
                                        >
                                          {formatCurrency(itemCalc.netProfit)}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3 text-sm">
                                        <span
                                          className={
                                            itemCalc.profitMargin >= 0
                                              ? "text-green-600"
                                              : "text-red-600"
                                          }
                                        >
                                          {itemCalc.profitMargin.toFixed(2)}%
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {renderPagination(filteredOrders.length)}
            </div>
          )}

          {/* SKUs View */}
          {calculations && showSkusList && currentView === "skus" && (
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-800">
                  Detalhamento por SKU -{" "}
                  {showCustomInput
                    ? customPointsMultiplier
                    : selectedPointsMultiplier}{" "}
                  Pontos/R$
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Pedido
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Reference Code
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Produto
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Data
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Qtd
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Preço Unit
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Venda
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Custo Unit
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Custo
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Pontos Dados
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Custo Pontos
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Custo Frete
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Lucro Bruto
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Lucro Líquido
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Margem %
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {getPaginatedItems(calculations).map((item, index) => {
                      const calc = getSelectedCalculation(item);
                      return (
                        <tr
                          key={index}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                            {item.orderNumber}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {item.referenceCode}
                          </td>
                          <td
                            className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate"
                            title={item.productName}
                          >
                            {item.productName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {item.orderDate ? formatDate(item.orderDate) : "-"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {item.quantity}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(item.unitSaleValue)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(item.saleValue)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(item.unitCostValue)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(item.costValue)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatNumber(calc.totalPoints)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(calc.pointsCost)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(calc.shippingCost || 0)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(calc.grossProfit)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span
                              className={
                                calc.netProfit >= 0
                                  ? "text-green-600"
                                  : "text-red-600"
                              }
                            >
                              {formatCurrency(calc.netProfit)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span
                              className={
                                calc.profitMargin >= 0
                                  ? "text-green-600"
                                  : "text-red-600"
                              }
                            >
                              {calc.profitMargin.toFixed(2)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {renderPagination(filteredOrders.length)}
            </div>
          )}

          {/* Info Section */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-200">
            <h3 className="text-lg font-semibold text-blue-800 mb-3">
              Como funciona o cálculo:
            </h3>
            <div className="grid md:grid-cols-2 gap-4 text-sm text-blue-700">
              <div>
                <p className="mb-2">
                  <strong>• Pontos dados:</strong> (Preço unitário × Quantidade)
                  × Multiplicador escolhido
                </p>
                <p className="mb-2">
                  <strong>• Custo dos pontos:</strong> Total de pontos × R$
                  0,0449
                </p>
              </div>
              <div>
                <p className="mb-2">
                  <strong>• Lucro bruto:</strong> (Preço - Custo) × Quantidade
                </p>
                <p className="mb-2">
                  <strong>• Lucro líquido:</strong> Lucro bruto - Custo dos
                  pontos
                </p>
              </div>
            </div>
            <div className="mt-4 p-4 bg-blue-100 rounded-lg">
              <p className="text-blue-800 text-sm">
                <strong>Nova funcionalidade:</strong> Agora você pode visualizar
                os dados agrupados por pedido ou por SKU individual. Use o
                filtro de pedidos para encontrar rapidamente informações
                específicas e clique nos pedidos para expandir os detalhes de
                cada item.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default function Home() {
  return <LiveloPointsCalculator />;
}
