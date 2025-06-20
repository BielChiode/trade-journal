import React, { useState, useEffect } from "react";
import {
  Edit,
  Trash2,
  TrendingUp,
  TrendingDown,
  GitCommitHorizontal,
  CheckCircle,
  Clock,
  ArrowUp,
  ArrowDown,
  PlusCircle,
} from "lucide-react";
import Modal from "./ui/Modal";
import TradeForm from "./TradeForm";
import { Button } from "./ui/Button";
import ConfirmationModal from "./ui/ConfirmationModal";
import { Trade } from "../types/trade";
import { cn } from "../lib/utils";
import ButtonLoader from "./ui/ButtonLoader";
import { PositionSummary } from "../lib/tradeUtils";

interface TradeDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  position: PositionSummary | null;
  onUpdateTrade: (id: number, trade: Trade) => Promise<void>;
  onDeleteTrade: (id: number) => Promise<void>;
  onOpenPartialExit: (trade: Trade) => void;
  onOpenIncrement: (trade: Trade) => void;
  startInEditMode?: boolean;
}

const TradeDetailsModal: React.FC<TradeDetailsModalProps> = ({
  isOpen,
  onClose,
  position,
  onUpdateTrade,
  onDeleteTrade,
  onOpenPartialExit,
  onOpenIncrement,
  startInEditMode = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [tradeToEdit, setTradeToEdit] = useState<Trade | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Se startInEditMode for true, edita o trade de entrada
      const initialTrade = position?.tradesInPosition.sort(
        (a, b) =>
          new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime()
      )[0];
      setTradeToEdit(initialTrade || null);
      setIsEditing(startInEditMode);
    } else {
      setTimeout(() => {
        setIsEditing(false);
        setIsConfirmModalOpen(false);
        setTradeToEdit(null);
      }, 200);
    }
  }, [isOpen, startInEditMode, position]);

  if (!position) return null;

  const handleEdit = () => {
    const initialTrade = position.tradesInPosition.sort(
      (a, b) =>
        new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime()
    )[0];
    setTradeToEdit(initialTrade);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (startInEditMode) {
      onClose();
    } else {
      setIsEditing(false);
      setTradeToEdit(null);
    }
  };

  const handleUpdateTrade = async (tradeData: Trade) => {
    if (!tradeToEdit) return;
    try {
      await onUpdateTrade(tradeToEdit.id!, tradeData);
      setIsEditing(false);
      setTradeToEdit(null);
      if (startInEditMode) {
        onClose();
      }
    } catch (error) {
      console.error("Erro ao atualizar trade:", error);
      throw error;
    }
  };

  const handleDeleteClick = () => {
    setIsConfirmModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!tradeToEdit) return;
    setIsDeleting(true);
    try {
      await onDeleteTrade(tradeToEdit.id!);
      setIsConfirmModalOpen(false);
      onClose();
    } catch (error) {
      console.error("Erro ao excluir trade:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const isProfit = position.totalRealizedProfit >= 0;

  // Encontra o trade principal que ainda está aberto na posição
  const openTrade = position.tradesInPosition.find(
    (t) => !t.exit_date && !t.observations?.startsWith("Increment to trade")
  );

  // Filtra os eventos de histórico (parciais e incrementos)
  const historyEvents = position.tradesInPosition
    .filter((trade) => {
      const isPartialExit = !!trade.exit_date;
      const isIncrement =
        !trade.exit_date &&
        trade.observations?.startsWith("Increment to trade");
      return isPartialExit || isIncrement;
    })
    .sort((a, b) => {
      const dateA = new Date(a.exit_date || a.entry_date).getTime();
      const dateB = new Date(b.exit_date || b.entry_date).getTime();
      return dateA - dateB;
    });

  const closedTrades = position.tradesInPosition.filter(
    (t) => t.exit_price != null && t.exit_price > 0
  );
  let averageExitPrice = 0;
  let lastExitDate: string | null = null;

  if (closedTrades.length > 0) {
    const totalExitValue = closedTrades.reduce(
      (acc, t) => acc + t.exit_price! * t.quantity,
      0
    );
    const totalExitedQuantity = closedTrades.reduce(
      (acc, t) => acc + t.quantity,
      0
    );

    if (totalExitedQuantity > 0) {
      averageExitPrice = totalExitValue / totalExitedQuantity;
    }

    const latestTrade = closedTrades.sort(
      (a, b) =>
        new Date(b.exit_date!).getTime() - new Date(a.exit_date!).getTime()
    )[0];
    lastExitDate = latestTrade.exit_date || null;
  }

  const isPartiallyEditable =
    position.status === "Closed" || position.tradesInPosition.length > 1;

  if (isEditing && tradeToEdit) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Editar Trade">
        <TradeForm
          onUpdateTrade={handleUpdateTrade}
          onCancel={handleCancelEdit}
          initialData={tradeToEdit}
          isEditing={true}
          isPartiallyEditable={isPartiallyEditable}
        />
      </Modal>
    );
  }

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Detalhes da Posição">
        <div className="space-y-4 sm:space-y-6">
          {/* Header com ticker e resultado */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h3 className="text-xl sm:text-2xl font-bold">{position.ticker}</h3>
            {position.status === "Closed" && (
              <div
                className={`flex items-center gap-2 px-3 py-1 rounded-full self-start sm:self-auto ${
                  isProfit
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {isProfit ? (
                  <TrendingUp size={16} />
                ) : (
                  <TrendingDown size={16} />
                )}
                <span className="font-semibold">
                  R$ {position.totalRealizedProfit.toFixed(2)}
                </span>
              </div>
            )}
          </div>
          <div className="pb-3 pt-2 border-t">
            <div
              className={cn(
                "flex items-center gap-2 text-sm",
                position.status === "Open" ? "text-blue-600" : "text-gray-500"
              )}
            >
              {position.status === "Open" ? (
                <Clock size={12} />
              ) : (
                <CheckCircle size={12} />
              )}
              <span>
                Posição {position.status === "Open" ? "Aberta" : "Fechada"}
              </span>
            </div>
          </div>
          {/* Histórico da Posição */}
          {historyEvents.length > 0 && (
            <div className="space-y-3 rounded-md border p-3">
              <h4 className="font-semibold text-base">Histórico da Posição</h4>
              {historyEvents.map((event) => {
                const isIncrement =
                  event.observations?.startsWith("Increment to trade");

                if (isIncrement) {
                  return (
                    <div
                      key={`event-${event.id}`}
                      className="flex justify-between items-center text-sm py-1"
                    >
                      <div className="flex items-center gap-2">
                        {position.type === "Buy" ? (
                          <ArrowUp size={18} className="text-green-500" />
                        ) : (
                          <ArrowDown size={18} className="text-green-500" />
                        )}
                        <div>
                          <p className="font-medium text-gray-800">
                            Incremento: {event.quantity} @ R${" "}
                            {event.entry_price.toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-500">
                            Em{" "}
                            {new Date(event.entry_date).toLocaleDateString(
                              "pt-BR",
                              { timeZone: "UTC" }
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                } else {
                  // É uma saída parcial
                  return (
                    <div
                      key={`event-${event.id}`}
                      className="flex justify-between items-center text-sm py-1"
                    >
                      <div className="flex items-center gap-2">
                        {position.type === "Buy" ? (
                          <ArrowDown size={18} className="text-red-500" />
                        ) : (
                          <ArrowUp size={18} className="text-blue-500" />
                        )}
                        <div>
                          <p className="font-medium text-gray-800">
                            {position.type === "Buy"
                              ? "Venda Parcial"
                              : "Compra Parcial"}
                            : {event.quantity} @ R${" "}
                            {event.exit_price!.toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-500">
                            Saída em{" "}
                            {new Date(event.exit_date!).toLocaleDateString(
                              "pt-BR",
                              { timeZone: "UTC" }
                            )}
                          </p>
                        </div>
                      </div>
                      <p
                        className={`font-semibold ${
                          event.result! >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {event.result! >= 0 ? "+" : ""}R${" "}
                        {event.result!.toFixed(2)}
                      </p>
                    </div>
                  );
                }
              })}
              {/* Total Realizado */}
              {closedTrades.length > 0 && (
                <div className="flex justify-between items-center text-sm font-bold pt-2 border-t">
                  <span>Total Realizado</span>
                  <span
                    className={`${
                      isProfit ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {isProfit ? "+" : ""}R${" "}
                    {position.totalRealizedProfit.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Informações básicas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="text-xs sm:text-sm font-medium text-gray-600">
                Tipo
              </label>
              <div className="mt-1">
                <span
                  className={cn(
                    "px-2.5 py-0.5 text-sm font-semibold rounded-full",
                    position.type === "Buy"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-red-100 text-red-800"
                  )}
                >
                  {position.type === "Buy" ? "Compra" : "Venda"}
                </span>
              </div>
            </div>
            <div>
              <label className="text-xs sm:text-sm font-medium text-gray-600">
                Data de Entrada
              </label>
              <p className="mt-1 text-sm sm:text-base font-medium">
                {new Date(position.entry_date).toLocaleDateString("pt-BR", {
                  timeZone: "UTC",
                })}
              </p>
            </div>
            <div>
              <label className="text-xs sm:text-sm font-medium text-gray-600">
                Preço de Entrada
              </label>
              <p className="mt-1 text-sm sm:text-base font-medium">
                R$ {position.entry_price.toFixed(2)}
              </p>
            </div>
            <div>
              <label className="text-xs sm:text-sm font-medium text-gray-600">
                {closedTrades.length > 1
                  ? "Preço Médio de Saída"
                  : "Preço de Saída"}
              </label>
              <p className="mt-1 text-sm sm:text-base font-medium">
                {closedTrades.length > 0
                  ? `R$ ${averageExitPrice.toFixed(2)}`
                  : "-"}
              </p>
            </div>
            {position.status === "Open" ? (
              <>
                <div>
                  <label className="text-xs sm:text-sm font-medium text-gray-600">
                    Quantidade Inicial
                  </label>
                  <p className="mt-1 text-sm sm:text-base font-medium">
                    {position.initialQuantity}
                  </p>
                </div>
                <div>
                  <label className="text-xs sm:text-sm font-medium text-gray-600">
                    Quantidade em Aberto
                  </label>
                  <p className="mt-1 text-sm sm:text-base font-medium">
                    {position.openQuantity}
                  </p>
                </div>
              </>
            ) : (
              <div>
                <label className="text-xs sm:text-sm font-medium text-gray-600">
                  Quantidade Total
                </label>
                <p className="mt-1 text-sm sm:text-base font-medium">
                  {position.initialQuantity}
                </p>
              </div>
            )}

            <div>
              <label className="text-xs sm:text-sm font-medium text-gray-600">
                Data de Saída
              </label>
              <p className="mt-1 text-sm sm:text-base font-medium">
                {lastExitDate
                  ? new Date(lastExitDate).toLocaleDateString("pt-BR", {
                      timeZone: "UTC",
                    })
                  : "-"}
              </p>
            </div>
          </div>

          {/* Additional Info */}
          {(position.setup || position.observations) && (
            <div className="space-y-3">
              {position.setup && (
                <div>
                  <label className="text-xs sm:text-sm font-medium text-gray-600">
                    Setup
                  </label>
                  <p className="mt-1 text-sm sm:text-base">{position.setup}</p>
                </div>
              )}
              {position.observations && (
                <div>
                  <label className="text-xs sm:text-sm font-medium text-gray-600">
                    Observações
                  </label>
                  <p className="mt-1 text-sm sm:text-base whitespace-pre-wrap">
                    {position.observations}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
        {/* Botões de Ação */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 mt-6 pt-4 border-t">
          {openTrade && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <Button
                variant="outline"
                onClick={() => onOpenPartialExit(openTrade)}
                className="w-full"
              >
                <TrendingDown className="mr-2 h-4 w-4" /> Saída Parcial
              </Button>
              <Button
                variant="outline"
                onClick={() => onOpenIncrement(openTrade)}
                className="w-full"
              >
                <PlusCircle className="mr-2 h-4 w-4" /> Incrementar Posição
              </Button>
            </div>
          )}

          <Button
            variant="default"
            onClick={handleEdit}
            disabled={isDeleting}
            className="w-full sm:w-auto"
          >
            <Edit size={16} className="mr-2" />
            Editar
          </Button>
          <Button
            variant="destructive"
            onClick={handleDeleteClick}
            disabled={isDeleting}
            className="w-full sm:w-auto"
          >
            {isDeleting ? (
              <ButtonLoader text="Excluindo..." />
            ) : (
              <>
                <Trash2 size={16} className="mr-2" />
                Excluir Posição
              </>
            )}
          </Button>
        </div>
      </Modal>
      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Confirmar Exclusão"
        message="Você tem certeza que deseja excluir este trade? Esta ação não pode ser desfeita."
        confirmText="Excluir"
        cancelText="Cancelar"
        loading={isDeleting}
      />
    </>
  );
};

export default TradeDetailsModal;
